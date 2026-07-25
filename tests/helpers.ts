import {
  createGame,
  createPlayer,
  hit,
  startRound,
  tick,
  waitingOn,
} from '../shared/game/engine.js';
import type {
  ActionKind,
  Card,
  GameState,
  PlayerState,
} from '../shared/game/types.js';

let uid = 0;

export const num = (value: number): Card => ({
  id: `n${value}-${uid++}`,
  kind: 'number',
  value,
});
export const act = (action: ActionKind): Card => ({
  id: `a${action}-${uid++}`,
  kind: 'action',
  action,
});
export const x2 = (): Card => ({ id: `x2-${uid++}`, kind: 'modifier', modifier: 'x2' });
export const plus = (value: number): Card => ({
  id: `p${value}-${uid++}`,
  kind: 'modifier',
  modifier: 'plus',
  value,
});

/**
 * Builds a game already past the opening deal, with a fully controlled draw
 * pile. `deck[0]` is the next card drawn.
 */
export function makeGame(
  playerNames: string[],
  deck: Card[],
  opts: { targetScore?: number } = {},
): GameState {
  const state = createGame('TEST', 'p0', { targetScore: opts.targetScore ?? 200 });
  state.players = playerNames.map((name, i) => createPlayer(`p${i}`, name));
  state.round = 1;
  state.phase = 'playing';
  state.dealerIndex = state.players.length - 1;
  state.turnIndex = 0;
  // drawCard() pops from the end, so reverse to make deck[0] the next draw.
  state.deck = [...deck].reverse();
  return state;
}

/** Builds a game sitting at the very start of a round's opening deal. */
export function makeDealingGame(playerNames: string[], deck: Card[]): GameState {
  const state = createGame('TEST', 'p0');
  state.players = playerNames.map((name, i) => createPlayer(`p${i}`, name));
  state.deck = [...deck].reverse();
  state.dealerIndex = state.players.length - 1;
  startRound(state);
  // startRound bumps the round counter and rebuilds the deal queue but leaves
  // our stacked deck alone.
  return state;
}

export function player(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/**
 * Hits for whoever is currently on turn. Play passes after every flip, so tests
 * that want a player to draw twice have to come back around the table.
 */
export function hitCurrent(state: GameState): string {
  const wait = waitingOn(state);
  if (wait?.type !== 'decision') {
    throw new Error(`expected a decision, got ${JSON.stringify(wait)}`);
  }
  hit(state, wait.playerId);
  return wait.playerId;
}

/** Runs the engine until it needs input (or `limit` steps elapse). */
export function runUntilInput(state: GameState, limit = 200): void {
  let steps = 0;
  while (waitingOn(state) === null && steps++ < limit) {
    tick(state);
  }
  if (steps >= limit) throw new Error('engine did not settle — possible infinite loop');
}

/** Gives a player a tableau directly, for tests that need a specific setup. */
export function seed(
  state: GameState,
  id: string,
  values: number[],
  extras: Card[] = [],
): PlayerState {
  const p = player(state, id);
  p.numbers = values.map((v) => num(v) as Extract<Card, { kind: 'number' }>);
  for (const card of extras) {
    if (card.kind === 'modifier') p.modifiers.push(card);
    if (card.kind === 'action' && card.action === 'second_chance') p.secondChance = card;
  }
  return p;
}
