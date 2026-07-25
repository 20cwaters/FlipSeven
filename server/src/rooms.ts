/**
 * Room registry and the loop that drives each game forward.
 *
 * The engine never schedules anything itself; this module repeatedly asks
 * `waitingOn(state)` and either steps the engine on a timer (so deals and forced
 * draws are watchable), asks a bot to decide, or stops and waits for a human.
 */

import {
  type Card,
  type GameState,
  type PlayerState,
  chooseBotTarget,
  chooseTarget,
  createGame,
  createPlayer,
  getPlayer,
  hit,
  nextRound,
  shouldHit,
  startGame,
  stay,
  tick,
  waitingOn,
} from '../../shared/game/index.js';

export interface Room {
  code: string;
  state: GameState;
  /** playerId -> socket id. Absent means that player is disconnected. */
  sockets: Map<string, string>;
  timer: NodeJS.Timeout | null;
  /** Wall-clock ms of the last activity, used to reap abandoned rooms. */
  lastActivity: number;
  /** Called whenever the state changes so the server can broadcast. */
  broadcast: (state: GameState) => void;
}

const rooms = new Map<string, Room>();

/**
 * Flip 7 is public information — but only what's face-up. The deck order and the
 * discard pile are not, so they're replaced with same-length filler before the
 * state goes over the wire. Clients and bots only ever read `.length` off these,
 * and this stops a player with devtools open from reading the next card.
 */
const HIDDEN_CARD: Card = { id: 'hidden', kind: 'number', value: 0 };

export function publicState(state: GameState): GameState {
  return {
    ...state,
    deck: new Array(state.deck.length).fill(HIDDEN_CARD),
    discard: new Array(state.discard.length).fill(HIDDEN_CARD),
  };
}

/** How long a human has before we auto-play for them (disconnect safety net). */
const DISCONNECTED_GRACE_MS = 4000;
/** Rooms with no activity for this long are dropped. */
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

export function generateRoomCode(): string {
  let code = '';
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(
  hostId: string,
  broadcast: (state: GameState) => void,
  settings: { maxPlayers: number; targetScore: number },
): Room {
  const code = generateRoomCode();
  const room: Room = {
    code,
    state: createGame(code, hostId, settings),
    sockets: new Map(),
    timer: null,
    lastActivity: Date.now(),
    broadcast,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string) {
  const room = rooms.get(code);
  if (room?.timer) clearTimeout(room.timer);
  rooms.delete(code);
}

export function roomCount(): number {
  return rooms.size;
}

let botCounter = 0;
const BOT_NAMES = [
  'Ada',
  'Bingo',
  'Cassidy',
  'Domino',
  'Echo',
  'Fable',
  'Gus',
  'Hazel',
];

export function addBot(room: Room): PlayerState | null {
  if (room.state.players.length >= room.state.settings.maxPlayers) return null;
  const used = new Set(room.state.players.map((p) => p.name));
  const name =
    BOT_NAMES.find((n) => !used.has(`${n} (bot)`)) ?? `Bot ${++botCounter}`;
  const bot = createPlayer(`bot-${++botCounter}-${Date.now().toString(36)}`, `${name} (bot)`, true);
  room.state.players.push(bot);
  room.state.version += 1;
  return bot;
}

// ---------------------------------------------------------------------------
// The drive loop
// ---------------------------------------------------------------------------

/**
 * Broadcasts the current state, then schedules whatever should happen next.
 * Call this after *every* mutation of `room.state`.
 */
export function drive(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  room.lastActivity = Date.now();
  room.broadcast(publicState(room.state));

  const state = room.state;
  const wait = waitingOn(state);

  // Engine can advance on its own — deal a card, run a forced draw, score a round.
  if (wait === null) {
    room.timer = setTimeout(() => {
      tick(state);
      drive(room);
    }, state.settings.dealDelayMs);
    return;
  }

  if (wait.type === 'round_end') {
    // Give everyone a beat to read the scoreboard, then deal the next round.
    room.timer = setTimeout(() => {
      nextRound(state);
      drive(room);
    }, 7000);
    return;
  }

  if (wait.type === 'lobby' || wait.type === 'game_over') return;

  const actor = getPlayer(state, wait.playerId);
  if (!actor) return;

  if (actor.isBot) {
    room.timer = setTimeout(() => {
      runBotTurn(room, actor.id);
    }, state.settings.botDelayMs);
    return;
  }

  // A human is on the clock. If they've dropped, play a sensible move for them
  // after a short grace period rather than stalling the table.
  if (!actor.connected) {
    room.timer = setTimeout(() => {
      runBotTurn(room, actor.id);
    }, DISCONNECTED_GRACE_MS);
  }
}

function runBotTurn(room: Room, playerId: string) {
  const state = room.state;
  const wait = waitingOn(state);
  if (!wait || (wait.type !== 'decision' && wait.type !== 'target')) {
    drive(room);
    return;
  }
  if (wait.playerId !== playerId) {
    drive(room);
    return;
  }
  const player = getPlayer(state, playerId);
  if (!player) return;

  if (wait.type === 'target' && state.pending) {
    chooseTarget(state, playerId, chooseBotTarget(state, player, state.pending));
  } else if (wait.type === 'decision') {
    // A disconnected human plays conservatively: bank rather than gamble.
    const wantsHit = player.isBot
      ? shouldHit(state, player)
      : player.numbers.length === 0;
    if (wantsHit) hit(state, playerId);
    else stay(state, playerId);
  }

  drive(room);
}

export function beginGame(room: Room) {
  startGame(room.state);
  drive(room);
}

/** Restarts a finished game with the same seats. */
export function restartGame(room: Room) {
  room.state.phase = 'lobby';
  room.state.round = 0;
  room.state.winnerIds = [];
  room.state.roundSummary = null;
  room.state.log = [];
  room.state.flash = null;
  for (const p of room.state.players) {
    p.totalScore = 0;
    p.lastRoundScore = null;
    p.numbers = [];
    p.modifiers = [];
    p.secondChance = null;
    p.status = 'active';
    p.hitFlipSeven = false;
  }
  room.state.version += 1;
  drive(room);
}

// Periodic sweep for rooms nobody came back to.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const hasHumans = room.state.players.some((p) => !p.isBot && p.connected);
    const stale = now - room.lastActivity > ROOM_TTL_MS;
    if (stale || (!hasHumans && now - room.lastActivity > 10 * 60 * 1000)) {
      if (room.timer) clearTimeout(room.timer);
      rooms.delete(code);
    }
  }
}, 60_000).unref?.();
