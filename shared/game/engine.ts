/**
 * Flip 7 rules engine.
 *
 * Everything here is a pure-ish state machine over `GameState`: functions mutate
 * the state object in place and never touch timers, sockets or the DOM. The
 * server drives it by repeatedly asking `waitingOn(state)` — when that returns
 * `null` the engine can advance itself via `tick(state)`; otherwise it is
 * blocked on a specific player's input (`hit` / `stay` / `chooseTarget`).
 *
 * That split is what makes the tricky bits work: a Flip Three sequence is just a
 * stack of pending forced draws, so an Action card drawn *during* a forced draw
 * resolves immediately and then control returns to the interrupted sequence.
 */

import {
  DEFAULT_TARGET_SCORE,
  FLIP_SEVEN_BONUS,
  FLIP_SEVEN_COUNT,
  buildDeck,
  cardLabel,
} from './cards.js';
import { type Rng, defaultRng, shuffle } from './rng.js';
import type {
  ActionCard,
  Card,
  GameSettings,
  GameState,
  LogKind,
  ModifierCard,
  NumberCard,
  PlayerState,
  RoundSummaryRow,
  WaitingOn,
} from './types.js';

export const DEFAULT_SETTINGS: GameSettings = {
  targetScore: DEFAULT_TARGET_SCORE,
  maxPlayers: 8,
  dealDelayMs: 750,
  botDelayMs: 1100,
};

const MAX_LOG_LINES = 60;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createPlayer(
  id: string,
  name: string,
  isBot = false,
): PlayerState {
  return {
    id,
    name,
    isBot,
    connected: true,
    totalScore: 0,
    numbers: [],
    modifiers: [],
    secondChance: null,
    status: 'active',
    lastRoundScore: null,
    hitFlipSeven: false,
  };
}

export function createGame(
  roomCode: string,
  hostId: string,
  settings: Partial<GameSettings> = {},
): GameState {
  return {
    roomCode,
    phase: 'lobby',
    round: 0,
    hostId,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [],
    dealerIndex: 0,
    turnIndex: 0,
    deck: [],
    discard: [],
    dealQueue: [],
    forced: [],
    pending: null,
    flipSevenBy: null,
    flash: null,
    log: [],
    roundSummary: null,
    winnerIds: [],
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function getPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function mustGetPlayer(state: GameState, id: string): PlayerState {
  const p = getPlayer(state, id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

export function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.status === 'active');
}

let logSeq = 0;
let flashSeq = 0;

function log(state: GameState, kind: LogKind, text: string, playerId?: string) {
  state.log.push({ id: ++logSeq, kind, text, playerId });
  if (state.log.length > MAX_LOG_LINES) {
    state.log.splice(0, state.log.length - MAX_LOG_LINES);
  }
}

/** Current round value of a tableau, with all modifiers applied. */
export function tableauScore(player: PlayerState, includeFlipSeven = true): number {
  if (player.status === 'busted') return 0;
  const base = player.numbers.reduce((sum, c) => sum + c.value, 0);
  const doubled = player.modifiers.some((m) => m.modifier === 'x2');
  const bonus = player.modifiers.reduce(
    (sum, m) => (m.modifier === 'plus' ? sum + m.value : sum),
    0,
  );
  const flipSeven =
    includeFlipSeven && player.numbers.length >= FLIP_SEVEN_COUNT ? FLIP_SEVEN_BONUS : 0;
  return (doubled ? base * 2 : base) + bonus + flipSeven;
}

function clearTableau(state: GameState, player: PlayerState) {
  state.discard.push(...player.numbers, ...player.modifiers);
  if (player.secondChance) state.discard.push(player.secondChance);
  player.numbers = [];
  player.modifiers = [];
  player.secondChance = null;
}

/** Draws one card, reshuffling the discard pile back in if the deck runs dry. */
export function drawCard(state: GameState, rng: Rng = defaultRng): Card | null {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return null;
    state.deck = shuffle(state.discard, rng);
    state.discard = [];
    log(state, 'info', 'Deck exhausted — discard pile reshuffled.');
  }
  return state.deck.pop() ?? null;
}

function flash(
  state: GameState,
  playerId: string,
  card: Card,
  source: 'deal' | 'hit' | 'forced',
  extra: { busted?: boolean; savedBySecondChance?: boolean } = {},
) {
  state.flash = { seq: ++flashSeq, playerId, card, source, ...extra };
}

/** Removes any queued forced draws belonging to a player who is no longer active. */
function dropForcedDrawsFor(state: GameState, playerId: string) {
  state.forced = state.forced.filter((f) => f.playerId !== playerId);
}

// ---------------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------------

export function startGame(state: GameState, rng: Rng = defaultRng) {
  if (state.players.length < 1) throw new Error('Need at least one player');
  state.round = 0;
  state.deck = shuffle(buildDeck(), rng);
  state.discard = [];
  state.winnerIds = [];
  for (const p of state.players) {
    p.totalScore = 0;
    p.lastRoundScore = null;
  }
  log(state, 'info', 'Game started. First to ' + state.settings.targetScore + ' wins!');
  // Dealer for round 1 is the host's seat; rotates from there.
  state.dealerIndex = state.players.length - 1;
  startRound(state, rng);
}

export function startRound(state: GameState, rng: Rng = defaultRng) {
  state.round += 1;
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  state.turnIndex = state.dealerIndex;
  state.forced = [];
  state.pending = null;
  state.flipSevenBy = null;
  state.roundSummary = null;
  state.flash = null;

  for (const p of state.players) {
    clearTableau(state, p);
    p.status = 'active';
    p.hitFlipSeven = false;
  }

  // Dealer deals one card to each player clockwise, starting to their left,
  // and finishing with themselves.
  state.dealQueue = orderFromDealer(state).map((p) => p.id);
  state.phase = 'dealing';

  const dealer = state.players[state.dealerIndex];
  log(state, 'round', `Round ${state.round} — ${dealer.name} deals.`);
}

/** Player order for a round: starts to the dealer's left, dealer goes last. */
function orderFromDealer(state: GameState): PlayerState[] {
  const n = state.players.length;
  const out: PlayerState[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(state.players[(state.dealerIndex + i) % n]);
  }
  return out;
}

/**
 * True when nobody can act any more: everyone has busted or banked, or a Flip 7
 * ended things early.
 */
export function isRoundOver(state: GameState): boolean {
  if (state.flipSevenBy) return true;
  if (state.pending) return false;
  if (state.dealQueue.length > 0) return false;
  if (state.forced.length > 0) return false;
  return activePlayers(state).length === 0;
}

export function endRound(state: GameState) {
  const summary: RoundSummaryRow[] = [];

  for (const p of state.players) {
    const busted = p.status === 'busted';
    const base = busted ? 0 : p.numbers.reduce((s, c) => s + c.value, 0);
    const doubled = !busted && p.modifiers.some((m) => m.modifier === 'x2');
    const bonus = busted
      ? 0
      : p.modifiers.reduce((s, m) => (m.modifier === 'plus' ? s + m.value : s), 0);
    const flipSevenBonus = !busted && p.hitFlipSeven ? FLIP_SEVEN_BONUS : 0;
    const total = (doubled ? base * 2 : base) + bonus + flipSevenBonus;

    p.status = busted ? 'busted' : 'stayed';
    p.lastRoundScore = total;
    p.totalScore += total;

    summary.push({
      playerId: p.id,
      name: p.name,
      busted,
      base,
      doubled,
      bonus,
      flipSevenBonus,
      total,
      newTotal: p.totalScore,
    });
  }

  state.roundSummary = summary;

  const best = Math.max(...state.players.map((p) => p.totalScore));
  if (best >= state.settings.targetScore) {
    state.winnerIds = state.players.filter((p) => p.totalScore === best).map((p) => p.id);
    state.phase = 'game_over';
    const names = state.winnerIds.map((id) => mustGetPlayer(state, id).name).join(' & ');
    log(state, 'win', `${names} wins with ${best} points!`);
  } else {
    state.phase = 'round_end';
  }

  // Tableaux return to the discard pile so the deck can recycle.
  for (const p of state.players) clearTableau(state, p);
}

// ---------------------------------------------------------------------------
// Card resolution
// ---------------------------------------------------------------------------

/**
 * Applies a freshly drawn card to `playerId`. This is the heart of the rules:
 * duplicates bust (unless a Second Chance absorbs them), the 7th unique number
 * ends the round, and Action cards either resolve immediately or park the game
 * on a target-selection prompt.
 */
function resolveCard(
  state: GameState,
  player: PlayerState,
  card: Card,
  source: 'deal' | 'hit' | 'forced',
) {
  if (card.kind === 'number') {
    resolveNumberCard(state, player, card, source);
    return;
  }

  if (card.kind === 'modifier') {
    player.modifiers.push(card as ModifierCard);
    flash(state, player.id, card, source);
    log(
      state,
      'modifier',
      `${player.name} picked up ${cardLabel(card)}.`,
      player.id,
    );
    return;
  }

  resolveActionCard(state, player, card, source);
}

function resolveNumberCard(
  state: GameState,
  player: PlayerState,
  card: NumberCard,
  source: 'deal' | 'hit' | 'forced',
) {
  const duplicate = player.numbers.some((c) => c.value === card.value);

  if (duplicate && player.secondChance) {
    // Second Chance absorbs the duplicate: both cards go to the discard pile
    // and the player carries on with the tableau they already had.
    state.discard.push(player.secondChance, card);
    player.secondChance = null;
    flash(state, player.id, card, source, { savedBySecondChance: true });
    log(
      state,
      'second_chance',
      `${player.name} drew a duplicate ${card.value} — Second Chance saves them!`,
      player.id,
    );
    return;
  }

  if (duplicate) {
    player.status = 'busted';
    flash(state, player.id, card, source, { busted: true });
    log(
      state,
      'bust',
      `${player.name} drew a second ${card.value} and BUSTED.`,
      player.id,
    );
    state.discard.push(card);
    clearTableau(state, player);
    dropForcedDrawsFor(state, player.id);
    state.dealQueue = state.dealQueue.filter((id) => id !== player.id);
    return;
  }

  player.numbers.push(card);
  flash(state, player.id, card, source);
  log(state, 'draw', `${player.name} flipped a ${card.value}.`, player.id);

  if (player.numbers.length >= FLIP_SEVEN_COUNT) {
    triggerFlipSeven(state, player);
  }
}

function triggerFlipSeven(state: GameState, player: PlayerState) {
  player.hitFlipSeven = true;
  state.flipSevenBy = player.id;
  // A Flip 7 stops everything: no more forced draws, no pending targeting, and
  // nobody else gets another decision.
  state.forced = [];
  state.pending = null;
  state.dealQueue = [];
  log(
    state,
    'flip7',
    `FLIP 7! ${player.name} collected 7 unique numbers (+${FLIP_SEVEN_BONUS} bonus). The round ends for everyone.`,
    player.id,
  );
}

function resolveActionCard(
  state: GameState,
  player: PlayerState,
  card: ActionCard,
  source: 'deal' | 'hit' | 'forced',
) {
  flash(state, player.id, card, source);

  if (card.action === 'second_chance') {
    if (!player.secondChance) {
      player.secondChance = card;
      log(
        state,
        'second_chance',
        `${player.name} takes a Second Chance.`,
        player.id,
      );
      return;
    }
    // Already holding one — it must be passed to an active player who has none.
    const targets = activePlayers(state)
      .filter((p) => p.id !== player.id && !p.secondChance)
      .map((p) => p.id);

    if (targets.length === 0) {
      state.discard.push(card);
      log(
        state,
        'second_chance',
        `${player.name} drew a second Second Chance with nobody to give it to — discarded.`,
        player.id,
      );
      return;
    }
    if (targets.length === 1) {
      applyTarget(state, card, 'second_chance_pass', player.id, targets[0]);
      return;
    }
    state.pending = {
      card,
      reason: 'second_chance_pass',
      actorId: player.id,
      targets,
    };
    log(
      state,
      'second_chance',
      `${player.name} must pass a Second Chance to another player.`,
      player.id,
    );
    return;
  }

  // Freeze / Flip Three: target any currently-active player, including yourself.
  const targets = activePlayers(state).map((p) => p.id);

  if (targets.length === 0) {
    // Can happen if the drawer busted... which can't, since they just drew. Kept
    // as a guard so a weird state can never wedge the engine.
    state.discard.push(card);
    return;
  }
  if (targets.length === 1) {
    applyTarget(state, card, card.action, player.id, targets[0]);
    return;
  }

  state.pending = {
    card,
    reason: card.action,
    actorId: player.id,
    targets,
  };
  log(
    state,
    card.action === 'freeze' ? 'freeze' : 'flip_three',
    `${player.name} drew ${cardLabel(card)} and must choose a target.`,
    player.id,
  );
}

/** Applies a resolved Action card to its chosen target. */
function applyTarget(
  state: GameState,
  card: ActionCard,
  reason: 'freeze' | 'flip_three' | 'second_chance_pass',
  actorId: string,
  targetId: string,
) {
  const actor = mustGetPlayer(state, actorId);
  const target = mustGetPlayer(state, targetId);
  const self = actorId === targetId;

  if (reason === 'second_chance_pass') {
    target.secondChance = card;
    log(
      state,
      'second_chance',
      `${actor.name} passed a Second Chance to ${target.name}.`,
      target.id,
    );
    return;
  }

  state.discard.push(card);

  if (reason === 'freeze') {
    target.status = 'stayed';
    dropForcedDrawsFor(state, target.id);
    state.dealQueue = state.dealQueue.filter((id) => id !== target.id);
    log(
      state,
      'freeze',
      self
        ? `${actor.name} froze themselves and banks ${tableauScore(target)}.`
        : `${actor.name} froze ${target.name}, who banks ${tableauScore(target)}.`,
      target.id,
    );
    return;
  }

  // Flip Three — pushed on top of the stack so it resolves before whatever
  // sequence was already running, then control returns there.
  state.forced.push({ playerId: target.id, remaining: 3, sourceCardId: card.id });
  log(
    state,
    'flip_three',
    self
      ? `${actor.name} hits themselves with Flip Three.`
      : `${actor.name} hits ${target.name} with Flip Three.`,
    target.id,
  );
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

/** What (if anything) the engine is blocked on. `null` means `tick()` can run. */
export function waitingOn(state: GameState): WaitingOn {
  if (state.phase === 'lobby') return { type: 'lobby' };
  if (state.phase === 'game_over') return { type: 'game_over' };
  if (state.pending) return { type: 'target', playerId: state.pending.actorId };
  if (state.phase === 'round_end') return { type: 'round_end' };
  if (isRoundOver(state)) return null; // tick() will score the round
  if (state.phase === 'dealing') return null;
  if (state.forced.length > 0) return null;

  const current = state.players[state.turnIndex];
  if (!current || current.status !== 'active') return null; // tick() advances the turn
  return { type: 'decision', playerId: current.id };
}

/**
 * Advances the game by one atomic step. Only call when `waitingOn()` is `null`.
 * Safe to call otherwise — it simply does nothing.
 */
export function tick(state: GameState, rng: Rng = defaultRng): boolean {
  if (waitingOn(state) !== null) return false;
  state.version += 1;

  if (isRoundOver(state)) {
    endRound(state);
    return true;
  }

  if (state.phase === 'dealing') {
    return tickDeal(state, rng);
  }

  if (state.forced.length > 0) {
    return tickForcedDraw(state, rng);
  }

  // Normal play: the current seat isn't able to act, so move to the next one.
  return advanceTurn(state);
}

function tickDeal(state: GameState, rng: Rng): boolean {
  const nextId = state.dealQueue.shift();

  if (nextId === undefined) {
    state.phase = 'playing';
    // Turn order starts to the dealer's left, same as the deal.
    state.turnIndex = state.dealerIndex;
    advanceTurn(state);
    return true;
  }

  const player = getPlayer(state, nextId);
  if (!player || player.status !== 'active') return true; // frozen/busted mid-deal

  const card = drawCard(state, rng);
  if (!card) {
    state.phase = 'playing';
    return true;
  }
  resolveCard(state, player, card, 'deal');
  return true;
}

function tickForcedDraw(state: GameState, rng: Rng): boolean {
  const top = state.forced[state.forced.length - 1];
  const player = getPlayer(state, top.playerId);

  if (!player || player.status !== 'active' || top.remaining <= 0) {
    state.forced.pop();
    return true;
  }

  top.remaining -= 1;
  const card = drawCard(state, rng);
  if (!card) {
    state.forced.pop();
    return true;
  }
  resolveCard(state, player, card, 'forced');
  return true;
}

/** Moves `turnIndex` to the next active player, wrapping around. */
function advanceTurn(state: GameState): boolean {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turnIndex + i) % n;
    if (state.players[idx].status === 'active') {
      state.turnIndex = idx;
      return true;
    }
  }
  return true; // nobody active — isRoundOver() will catch it next tick
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export function hit(state: GameState, playerId: string, rng: Rng = defaultRng): ActionResult {
  const wait = waitingOn(state);
  if (wait?.type !== 'decision' || wait.playerId !== playerId) {
    return { ok: false, error: "It's not your turn." };
  }
  state.version += 1;
  const player = mustGetPlayer(state, playerId);
  const card = drawCard(state, rng);
  if (!card) return { ok: false, error: 'No cards left to draw.' };
  resolveCard(state, player, card, 'hit');

  // One flip per turn: play always passes on, whether or not they survived.
  // (Forced Flip Three draws are the exception, and they run off their own
  // stack before the next player is asked to decide.)
  advanceTurn(state);
  return { ok: true };
}

export function stay(state: GameState, playerId: string): ActionResult {
  const wait = waitingOn(state);
  if (wait?.type !== 'decision' || wait.playerId !== playerId) {
    return { ok: false, error: "It's not your turn." };
  }
  state.version += 1;
  const player = mustGetPlayer(state, playerId);
  player.status = 'stayed';
  state.flash = null;
  log(state, 'stay', `${player.name} stays and banks ${tableauScore(player)}.`, player.id);
  advanceTurn(state);
  return { ok: true };
}

export function chooseTarget(
  state: GameState,
  playerId: string,
  targetId: string,
): ActionResult {
  const pending = state.pending;
  if (!pending) return { ok: false, error: 'Nothing to target right now.' };
  if (pending.actorId !== playerId) {
    return { ok: false, error: 'You are not choosing a target.' };
  }
  if (!pending.targets.includes(targetId)) {
    return { ok: false, error: 'That player cannot be targeted.' };
  }
  state.version += 1;
  state.pending = null;
  applyTarget(state, pending.card, pending.reason, playerId, targetId);

  // Freezing yourself (or the only remaining player) can end the round outright.
  if (state.phase === 'playing' || state.phase === 'dealing') {
    const current = state.players[state.turnIndex];
    if (current && current.status !== 'active') advanceTurn(state);
  }
  return { ok: true };
}

/**
 * Pulls a player out of the game entirely — they tapped Leave, or the host
 * removed them. Safe to call at any point in a round: their cards go back to
 * the discard pile, they're scrubbed from the deal queue, any forced draws and
 * targeting prompts that referenced them are repaired, and the dealer/turn
 * indices are shifted so they keep pointing at the same seats.
 */
export function removePlayer(state: GameState, playerId: string): ActionResult {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) return { ok: false, error: 'That player is not in this game.' };

  state.version += 1;
  const [gone] = state.players.splice(index, 1);
  log(state, 'info', `${gone.name} left the game.`);

  clearTableau(state, gone);
  state.dealQueue = state.dealQueue.filter((id) => id !== playerId);
  state.forced = state.forced.filter((f) => f.playerId !== playerId);
  state.winnerIds = state.winnerIds.filter((id) => id !== playerId);
  state.roundSummary =
    state.roundSummary?.filter((row) => row.playerId !== playerId) ?? null;
  if (state.flipSevenBy === playerId) state.flipSevenBy = null;
  if (state.flash?.playerId === playerId) state.flash = null;

  // A prompt owned by the leaver is abandoned; one merely *aimed* at them just
  // loses that option (and is abandoned too if nothing legal is left).
  if (state.pending) {
    if (state.pending.actorId === playerId) {
      state.discard.push(state.pending.card);
      state.pending = null;
    } else {
      state.pending.targets = state.pending.targets.filter((id) => id !== playerId);
      if (state.pending.targets.length === 0) {
        state.discard.push(state.pending.card);
        state.pending = null;
      }
    }
  }

  if (state.players.length === 0) {
    state.phase = 'game_over';
    return { ok: true };
  }

  const n = state.players.length;
  if (index < state.dealerIndex) state.dealerIndex -= 1;
  state.dealerIndex = Math.max(0, state.dealerIndex) % n;

  if (index < state.turnIndex) state.turnIndex -= 1;
  // If they *were* on turn, the splice already slid the next player into their
  // slot, so the index needs no adjustment — only a wrap.
  state.turnIndex = Math.max(0, state.turnIndex) % n;

  if (state.players[state.turnIndex].status !== 'active') advanceTurn(state);

  if (state.hostId === playerId) {
    const nextHost = state.players.find((p) => !p.isBot) ?? state.players[0];
    state.hostId = nextHost.id;
  }

  return { ok: true };
}

export function nextRound(state: GameState, rng: Rng = defaultRng): ActionResult {
  if (state.phase !== 'round_end') {
    return { ok: false, error: 'The round is still in progress.' };
  }
  state.version += 1;
  startRound(state, rng);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Read-only helpers used by the UI and the bots
// ---------------------------------------------------------------------------

/** Number values that would bust `player` if drawn. */
export function bustValues(player: PlayerState): number[] {
  return player.numbers.map((c) => c.value);
}
