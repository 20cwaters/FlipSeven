import { describe, expect, it } from 'vitest';

import {
  ACTION_CARD_COUNTS,
  EXPECTED_DECK_SIZE,
  NUMBER_CARD_COUNTS,
  PLUS_MODIFIER_COUNTS,
  X2_MODIFIER_COUNT,
  buildDeck,
  cardLabel,
} from '../shared/game/cards.js';
import { createRng, shuffle } from '../shared/game/rng.js';

describe('deck composition', () => {
  const deck = buildDeck();

  it('contains exactly the expected number of cards', () => {
    expect(deck).toHaveLength(EXPECTED_DECK_SIZE);
  });

  it('gives every card a unique id', () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it('has N copies of each number N (except 0 and 1)', () => {
    const counts = new Map<number, number>();
    for (const card of deck) {
      if (card.kind === 'number') {
        counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
      }
    }
    for (const [value, expected] of Object.entries(NUMBER_CARD_COUNTS)) {
      expect(counts.get(Number(value))).toBe(expected);
    }
    expect(counts.get(0)).toBe(1);
    expect(counts.get(1)).toBe(1);
    expect(counts.get(12)).toBe(12);
  });

  it('has the configured action card counts', () => {
    for (const [action, expected] of Object.entries(ACTION_CARD_COUNTS)) {
      const found = deck.filter((c) => c.kind === 'action' && c.action === action);
      expect(found).toHaveLength(expected);
    }
  });

  it('has the configured modifier cards', () => {
    const x2 = deck.filter((c) => c.kind === 'modifier' && c.modifier === 'x2');
    expect(x2).toHaveLength(X2_MODIFIER_COUNT);

    for (const [value, expected] of Object.entries(PLUS_MODIFIER_COUNTS)) {
      const found = deck.filter(
        (c) => c.kind === 'modifier' && c.modifier === 'plus' && c.value === Number(value),
      );
      expect(found).toHaveLength(expected);
    }
  });

  it('totals 79 number cards', () => {
    expect(deck.filter((c) => c.kind === 'number')).toHaveLength(79);
  });

  it('labels cards readably', () => {
    expect(cardLabel({ id: 'a', kind: 'number', value: 7 })).toBe('7');
    expect(cardLabel({ id: 'b', kind: 'action', action: 'flip_three' })).toBe('Flip Three');
    expect(cardLabel({ id: 'c', kind: 'modifier', modifier: 'x2' })).toBe('x2');
    expect(cardLabel({ id: 'd', kind: 'modifier', modifier: 'plus', value: 8 })).toBe('+8');
  });
});

describe('shuffling', () => {
  it('preserves every card', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck, createRng(42));
    expect(shuffled).toHaveLength(deck.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });

  it('does not mutate the input', () => {
    const deck = buildDeck();
    const before = deck.map((c) => c.id);
    shuffle(deck, createRng(7));
    expect(deck.map((c) => c.id)).toEqual(before);
  });

  it('actually reorders (same seed is reproducible, different seeds differ)', () => {
    const deck = buildDeck();
    const a = shuffle(deck, createRng(1)).map((c) => c.id);
    const b = shuffle(deck, createRng(1)).map((c) => c.id);
    const c = shuffle(deck, createRng(2)).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).not.toEqual(deck.map((x) => x.id));
  });

  it('distributes positions roughly evenly over many shuffles', () => {
    // Sanity check against an off-by-one Fisher-Yates: the first card should
    // land in the last slot about 1/n of the time, not never and not always.
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const rng = createRng(99);
    let lastSlotHits = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      if (shuffle(items, rng)[9] === 0) lastSlotHits++;
    }
    expect(lastSlotHits / runs).toBeGreaterThan(0.06);
    expect(lastSlotHits / runs).toBeLessThan(0.14);
  });
});
