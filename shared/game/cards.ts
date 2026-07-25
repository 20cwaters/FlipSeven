/**
 * DECK DATA — the single place to edit card counts.
 *
 * Adjust the numbers below to match your physical copy exactly; nothing else in
 * the codebase hard-codes a count. `assertDeckIntegrity()` (see tests) checks the
 * total against `EXPECTED_DECK_SIZE`, so bump that too if you change the deck.
 *
 * Stock Flip 7 (94 cards):
 *   79 number cards  — number N appears N times, except 0 and 1 which appear once each
 *    9 action cards  — 3 Freeze, 3 Flip Three, 3 Second Chance
 *    6 modifier cards — +2, +4, +6, +8, +10, x2 (one of each)
 */

import type { ActionKind, Card } from './types.js';

export const EXPECTED_DECK_SIZE = 94;

/** Points needed to win the game (checked at the end of a round). */
export const DEFAULT_TARGET_SCORE = 200;

/** Unique number cards required to trigger a Flip 7. */
export const FLIP_SEVEN_COUNT = 7;

/** Bonus added to the round score of the player who completes a Flip 7. */
export const FLIP_SEVEN_BONUS = 15;

/**
 * How many copies of each number card. Index = face value = point value.
 * Stock deck: one 0, one 1, then N copies of every N from 2 to 12.
 */
export const NUMBER_CARD_COUNTS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
};

export const ACTION_CARD_COUNTS: Record<ActionKind, number> = {
  freeze: 3,
  flip_three: 3,
  second_chance: 3,
};

/** Flat bonus modifiers: point value -> number of copies. */
export const PLUS_MODIFIER_COUNTS: Record<number, number> = {
  2: 1,
  4: 1,
  6: 1,
  8: 1,
  10: 1,
};

/** Copies of the x2 multiplier card. */
export const X2_MODIFIER_COUNT = 1;

export const ACTION_LABELS: Record<ActionKind, string> = {
  freeze: 'Freeze',
  flip_three: 'Flip Three',
  second_chance: 'Second Chance',
};

export const ACTION_DESCRIPTIONS: Record<ActionKind, string> = {
  freeze:
    'The targeted player immediately banks their points and is done for the round.',
  flip_three:
    'The targeted player must draw three cards, one at a time, resolving each as normal.',
  second_chance:
    'Stays face-up in your tableau. The next duplicate number you draw is discarded instead of busting you.',
};

/** Builds a fresh, ordered (unshuffled) deck. Every card gets a stable unique id. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let n = 0;
  const nextId = (prefix: string) => `${prefix}-${n++}`;

  for (const [valueKey, count] of Object.entries(NUMBER_CARD_COUNTS)) {
    const value = Number(valueKey);
    for (let i = 0; i < count; i++) {
      deck.push({ id: nextId(`num${value}`), kind: 'number', value });
    }
  }

  for (const [action, count] of Object.entries(ACTION_CARD_COUNTS) as [
    ActionKind,
    number,
  ][]) {
    for (let i = 0; i < count; i++) {
      deck.push({ id: nextId(`act-${action}`), kind: 'action', action });
    }
  }

  for (const [valueKey, count] of Object.entries(PLUS_MODIFIER_COUNTS)) {
    const value = Number(valueKey);
    for (let i = 0; i < count; i++) {
      deck.push({ id: nextId(`plus${value}`), kind: 'modifier', modifier: 'plus', value });
    }
  }

  for (let i = 0; i < X2_MODIFIER_COUNT; i++) {
    deck.push({ id: nextId('x2'), kind: 'modifier', modifier: 'x2' });
  }

  return deck;
}

/** Total copies of every number value in a full deck — used by the bot's odds math. */
export function fullNumberCounts(): Map<number, number> {
  const map = new Map<number, number>();
  for (const [valueKey, count] of Object.entries(NUMBER_CARD_COUNTS)) {
    map.set(Number(valueKey), count);
  }
  return map;
}

export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
      return String(card.value);
    case 'action':
      return ACTION_LABELS[card.action];
    case 'modifier':
      return card.modifier === 'x2' ? 'x2' : `+${card.value}`;
  }
}
