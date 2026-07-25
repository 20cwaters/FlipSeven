import { describe, expect, it } from 'vitest';

import { buildDeck } from '../shared/game/cards.js';
import { chooseBotTarget, computeOdds, shouldHit } from '../shared/game/bot.js';
import {
  chooseTarget,
  hit,
  nextRound,
  stay,
  tick,
  waitingOn,
} from '../shared/game/engine.js';
import { createRng, shuffle } from '../shared/game/rng.js';
import { act, makeDealingGame, makeGame, player, plus, seed, x2 } from './helpers.js';

/** Puts a realistic deck behind the state so the odds math has something to chew on. */
function withRealDeck(state: ReturnType<typeof makeGame>, seedValue = 3) {
  state.deck = shuffle(buildDeck(), createRng(seedValue));
  return state;
}

describe('odds', () => {
  it('reports zero bust chance for an empty tableau', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    expect(computeOdds(state, player(state, 'p0')).bustChance).toBe(0);
  });

  it('rises as the tableau fills with common numbers', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [12]);
    const small = computeOdds(state, player(state, 'p0')).bustChance;
    seed(state, 'p0', [12, 11, 10, 9]);
    const big = computeOdds(state, player(state, 'p0')).bustChance;
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });

  it('treats a 1 as far safer than a 12', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [1]);
    const withOne = computeOdds(state, player(state, 'p0')).bustChance;
    seed(state, 'p0', [12]);
    const withTwelve = computeOdds(state, player(state, 'p0')).bustChance;
    expect(withTwelve).toBeGreaterThan(withOne * 5);
  });

  it('counts a Second Chance as immunity to the next duplicate', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [12, 11, 10], [act('second_chance')]);
    const odds = computeOdds(state, player(state, 'p0'));
    expect(odds.bustChance).toBe(0);
    expect(odds.duplicateChance).toBeGreaterThan(0);
  });
});

describe('hit / stay decisions', () => {
  it('always hits an empty tableau', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    expect(shouldHit(state, player(state, 'p0'))).toBe(true);
  });

  it('stays on a big fragile pile', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [12, 11, 10, 9, 8, 7]);
    expect(shouldHit(state, player(state, 'p0'))).toBe(false);
  });

  it('stays when banking would win the game outright', () => {
    const state = withRealDeck(makeGame(['A', 'B'], [], { targetScore: 100 }));
    player(state, 'p0').totalScore = 90;
    seed(state, 'p0', [12]);
    expect(shouldHit(state, player(state, 'p0'))).toBe(false);
  });

  it('keeps hitting behind a Second Chance', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [12, 11, 10, 9], [act('second_chance')]);
    expect(shouldHit(state, player(state, 'p0'))).toBe(true);
  });

  it('is more willing to gamble when far behind', () => {
    const build = (myTotal: number, leaderTotal: number) => {
      const state = withRealDeck(makeGame(['A', 'B'], []));
      seed(state, 'p0', [12, 11, 9]);
      player(state, 'p0').totalScore = myTotal;
      player(state, 'p1').totalScore = leaderTotal;
      return state;
    };
    const even = build(80, 80);
    const behind = build(10, 170);
    // Same tableau, same odds — only the table position differs.
    expect(shouldHit(behind, player(behind, 'p0'))).toBe(true);
    expect(shouldHit(even, player(even, 'p0'))).toBe(false);
  });

  it('protects an x2 more carefully than a bare tableau', () => {
    const bare = withRealDeck(makeGame(['A', 'B'], []), 11);
    seed(bare, 'p0', [12, 11, 10]);

    const doubled = withRealDeck(makeGame(['A', 'B'], []), 11);
    seed(doubled, 'p0', [12, 11, 10], [x2()]);

    // The x2 raises both the upside and what's at risk; the guard against
    // throwing away a doubled pile should never be *less* cautious.
    if (!shouldHit(bare, player(bare, 'p0'))) {
      expect(shouldHit(doubled, player(doubled, 'p0'))).toBe(false);
    }
  });
});

describe('targeting', () => {
  it('freezes the biggest threat rather than itself', () => {
    const state = withRealDeck(makeGame(['Bot', 'Leader', 'Small'], []));
    seed(state, 'p0', [2]);
    seed(state, 'p1', [12, 11, 10]);
    player(state, 'p1').totalScore = 150;
    seed(state, 'p2', [3]);

    const target = chooseBotTarget(state, player(state, 'p0'), {
      card: { id: 'f1', kind: 'action', action: 'freeze' },
      reason: 'freeze',
      actorId: 'p0',
      targets: ['p0', 'p1', 'p2'],
    });
    expect(target).toBe('p1');
  });

  it('freezes itself when sitting on a fat, fragile pile', () => {
    const state = withRealDeck(makeGame(['Bot', 'Other'], []));
    seed(state, 'p0', [12, 11, 10, 9]);
    seed(state, 'p1', [2]);

    const target = chooseBotTarget(state, player(state, 'p0'), {
      card: { id: 'f2', kind: 'action', action: 'freeze' },
      reason: 'freeze',
      actorId: 'p0',
      targets: ['p0', 'p1'],
    });
    expect(target).toBe('p0');
  });

  it('takes Flip Three itself when its tableau is nearly empty', () => {
    const state = withRealDeck(makeGame(['Bot', 'Other'], []));
    seed(state, 'p0', [1]);
    seed(state, 'p1', [5]);

    const target = chooseBotTarget(state, player(state, 'p0'), {
      card: { id: 't1', kind: 'action', action: 'flip_three' },
      reason: 'flip_three',
      actorId: 'p0',
      targets: ['p0', 'p1'],
    });
    expect(target).toBe('p0');
  });

  it('aims Flip Three at the opponent most likely to blow up', () => {
    const state = withRealDeck(makeGame(['Bot', 'Safe', 'Loaded'], []));
    seed(state, 'p0', [12, 11, 10, 9]); // bot is too loaded to self-target
    seed(state, 'p1', [1]);
    seed(state, 'p2', [12, 11, 10, 9, 8]);

    const target = chooseBotTarget(state, player(state, 'p0'), {
      card: { id: 't2', kind: 'action', action: 'flip_three' },
      reason: 'flip_three',
      actorId: 'p0',
      targets: ['p0', 'p1', 'p2'],
    });
    expect(target).toBe('p2');
  });

  it('passes a spare Second Chance to whoever is furthest from winning', () => {
    const state = withRealDeck(makeGame(['Bot', 'Leader', 'Trailer'], []));
    player(state, 'p1').totalScore = 180;
    player(state, 'p2').totalScore = 20;

    const target = chooseBotTarget(state, player(state, 'p0'), {
      card: { id: 's1', kind: 'action', action: 'second_chance' },
      reason: 'second_chance_pass',
      actorId: 'p0',
      targets: ['p1', 'p2'],
    });
    expect(target).toBe('p2');
  });
});

describe('a full bot-only game', () => {
  it('plays to completion and produces a winner', () => {
    const state = makeDealingGame(['Bot A', 'Bot B', 'Bot C'], []);
    state.deck = shuffle(buildDeck(), createRng(2024));
    state.settings.targetScore = 200;

    let guard = 0;
    while (state.phase !== 'game_over' && guard++ < 20000) {
      const wait = waitingOn(state);
      if (wait === null) {
        tick(state);
      } else if (wait.type === 'decision') {
        const p = player(state, wait.playerId);
        if (shouldHit(state, p)) hit(state, wait.playerId);
        else stay(state, wait.playerId);
      } else if (wait.type === 'target') {
        const p = player(state, wait.playerId);
        chooseTarget(state, wait.playerId, chooseBotTarget(state, p, state.pending!));
      } else if (wait.type === 'round_end') {
        nextRound(state); // mirrors what the server does between rounds
      } else {
        break;
      }
    }

    expect(guard).toBeLessThan(20000);
    expect(state.phase).toBe('game_over');
    expect(state.winnerIds.length).toBeGreaterThan(0);
    const winner = player(state, state.winnerIds[0]);
    expect(winner.totalScore).toBeGreaterThanOrEqual(200);
  });

  it('bots reach a decision without stalling on modifiers', () => {
    const state = withRealDeck(makeGame(['A', 'B'], []));
    seed(state, 'p0', [4], [plus(10), x2()]);
    expect(typeof shouldHit(state, player(state, 'p0'))).toBe('boolean');
  });
});
