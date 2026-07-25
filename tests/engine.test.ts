import { describe, expect, it } from 'vitest';

import { FLIP_SEVEN_BONUS, buildDeck } from '../shared/game/cards.js';
import {
  chooseTarget,
  drawCard,
  endRound,
  hit,
  isRoundOver,
  nextRound,
  removePlayer,
  stay,
  tableauScore,
  tick,
  waitingOn,
} from '../shared/game/engine.js';
import { createRng, shuffle } from '../shared/game/rng.js';
import type { Card } from '../shared/game/types.js';
import {
  act,
  makeDealingGame,
  makeGame,
  num,
  player,
  plus,
  runUntilInput,
  seed,
  x2,
} from './helpers.js';

describe('turn order', () => {
  it('passes play after a single flip — one Hit per turn', () => {
    const state = makeGame(['A', 'B', 'C'], [num(5), num(9), num(2)]);
    expect(hit(state, 'p0').ok).toBe(true);
    expect(player(state, 'p0').numbers.map((c) => c.value)).toEqual([5]);
    // p0 does not get to keep flipping.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });

    hit(state, 'p1');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p2' });
    hit(state, 'p2');
    // Back around to p0 for their second flip.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p0' });
  });

  it('rejects a second flip from the player who just went', () => {
    const state = makeGame(['A', 'B'], [num(5), num(9)]);
    hit(state, 'p0');
    const result = hit(state, 'p0');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
    expect(player(state, 'p0').numbers).toHaveLength(1);
  });

  it('rejects a move from a player who is not on turn', () => {
    const state = makeGame(['A', 'B'], [num(5)]);
    const result = hit(state, 'p1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
  });

  it('banks on stay and passes the turn', () => {
    const state = makeGame(['A', 'B'], [num(5), num(3)]);
    stay(state, 'p0');
    expect(player(state, 'p0').status).toBe('stayed');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
  });

  it('skips players who have busted or banked', () => {
    const state = makeGame(['A', 'B', 'C'], [num(5), num(9)]);
    player(state, 'p1').status = 'stayed';
    hit(state, 'p0');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p2' });
  });

  it('returns to the same player when they are the last one active', () => {
    const state = makeGame(['A', 'B'], [num(5), num(9)]);
    player(state, 'p1').status = 'busted';
    hit(state, 'p0');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p0' });
  });
});

describe('busting', () => {
  it('busts on a duplicate number and zeroes the round', () => {
    const state = makeGame(['A', 'B'], [num(7)]);
    seed(state, 'p0', [7]);
    hit(state, 'p0');
    const p0 = player(state, 'p0');
    expect(p0.status).toBe('busted');
    expect(tableauScore(p0)).toBe(0);
    expect(p0.numbers).toHaveLength(0); // tableau goes to the discard pile
  });

  it('sends the busted tableau to the discard pile', () => {
    const state = makeGame(['A', 'B'], [num(7)]);
    seed(state, 'p0', [7, 4]);
    hit(state, 'p0');
    // 7, 4, and the duplicate 7 are all discarded.
    expect(state.discard).toHaveLength(3);
  });

  it('does not bust on a duplicate modifier value', () => {
    const state = makeGame(['A', 'B'], [plus(4)]);
    seed(state, 'p0', [], [plus(4)]);
    hit(state, 'p0');
    expect(player(state, 'p0').status).toBe('active');
    expect(player(state, 'p0').modifiers).toHaveLength(2);
  });

  it('ends the round once everyone has busted or banked', () => {
    const state = makeGame(['A', 'B'], [num(3)]);
    seed(state, 'p0', [3]);
    hit(state, 'p0'); // A: duplicate 3 -> bust
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
    stay(state, 'p1');
    expect(isRoundOver(state)).toBe(true);
    tick(state);
    expect(state.phase).toBe('round_end');
  });
});

describe('Second Chance', () => {
  it('is kept face-up when drawn and the player has none', () => {
    const state = makeGame(['A', 'B'], [act('second_chance')]);
    hit(state, 'p0');
    expect(player(state, 'p0').secondChance).not.toBeNull();
    // Drawing it still uses up the turn.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
  });

  it('absorbs a duplicate instead of busting, and both cards are discarded', () => {
    const state = makeGame(['A', 'B'], [num(8)]);
    seed(state, 'p0', [8], [act('second_chance')]);
    hit(state, 'p0'); // duplicate 8 -> saved

    const p0 = player(state, 'p0');
    expect(p0.status).toBe('active');
    expect(p0.secondChance).toBeNull();
    expect(p0.numbers.map((c) => c.value)).toEqual([8]);
    expect(state.discard).toHaveLength(2); // the shield and the duplicate
    expect(state.flash?.savedBySecondChance).toBe(true);
  });

  it('only protects once — the next duplicate still busts', () => {
    // Solo table so the same player draws twice in a row.
    const state = makeGame(['A'], [num(8), num(8)]);
    seed(state, 'p0', [8], [act('second_chance')]);
    hit(state, 'p0'); // saved
    expect(player(state, 'p0').status).toBe('active');
    hit(state, 'p0'); // no shield left
    expect(player(state, 'p0').status).toBe('busted');
  });

  it('passes a duplicate Second Chance to an eligible player automatically when only one qualifies', () => {
    const state = makeGame(['A', 'B'], [act('second_chance')]);
    seed(state, 'p0', [], [act('second_chance')]);
    hit(state, 'p0');
    expect(player(state, 'p1').secondChance).not.toBeNull();
    expect(state.pending).toBeNull();
  });

  it('prompts for a target when several players could receive the spare', () => {
    const state = makeGame(['A', 'B', 'C'], [act('second_chance')]);
    seed(state, 'p0', [], [act('second_chance')]);
    hit(state, 'p0');
    expect(state.pending?.reason).toBe('second_chance_pass');
    expect(state.pending?.targets.sort()).toEqual(['p1', 'p2']);
    // The drawer is never a candidate for their own spare.
    expect(state.pending?.targets).not.toContain('p0');

    chooseTarget(state, 'p0', 'p2');
    expect(player(state, 'p2').secondChance).not.toBeNull();
    expect(player(state, 'p1').secondChance).toBeNull();
  });

  it('discards the spare when nobody can take it', () => {
    const state = makeGame(['A', 'B'], [act('second_chance')]);
    seed(state, 'p0', [], [act('second_chance')]);
    seed(state, 'p1', [], [act('second_chance')]);
    hit(state, 'p0'); // everyone already holds one -> discard
    expect(state.pending).toBeNull();
    expect(state.discard.some((c) => c.kind === 'action')).toBe(true);
  });
});

describe('Freeze', () => {
  it('auto-resolves onto the drawer when they are the only active player', () => {
    const state = makeGame(['A', 'B'], [act('freeze')]);
    seed(state, 'p0', [4]);
    player(state, 'p1').status = 'stayed';

    hit(state, 'p0');
    // No choice to offer, so it lands on p0 without a prompt.
    expect(state.pending).toBeNull();
    expect(player(state, 'p0').status).toBe('stayed');
  });

  it('prompts for a target and banks whoever is chosen', () => {
    const state = makeGame(['A', 'B'], [act('freeze')]);
    seed(state, 'p1', [10, 2]);
    hit(state, 'p0');
    expect(state.pending?.reason).toBe('freeze');
    expect(state.pending?.targets.sort()).toEqual(['p0', 'p1']);

    chooseTarget(state, 'p0', 'p1');
    expect(player(state, 'p1').status).toBe('stayed');
    expect(player(state, 'p0').status).toBe('active');
  });

  it('lets a player freeze themselves', () => {
    const state = makeGame(['A', 'B'], [act('freeze')]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p0');
    expect(player(state, 'p0').status).toBe('stayed');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
  });

  it('rejects targeting a player who is not eligible', () => {
    const state = makeGame(['A', 'B', 'C'], [act('freeze')]);
    player(state, 'p2').status = 'busted';
    hit(state, 'p0');
    const result = chooseTarget(state, 'p0', 'p2');
    expect(result.ok).toBe(false);
    expect(state.pending).not.toBeNull();
  });
});

describe('Flip Three', () => {
  it('forces exactly three draws on the target, then returns the turn', () => {
    const state = makeGame(['A', 'B'], [act('flip_three'), num(2), num(3), num(4), num(5)]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');

    runUntilInput(state);

    expect(player(state, 'p1').numbers.map((c) => c.value)).toEqual([2, 3, 4]);
    expect(state.forced).toHaveLength(0);
    // p0 used their flip drawing it, so play has already moved on to p1.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
  });

  it('stops early when the forced draws bust the target', () => {
    const state = makeGame(['A', 'B'], [act('flip_three'), num(2), num(2), num(9)]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');
    runUntilInput(state);

    expect(player(state, 'p1').status).toBe('busted');
    expect(state.forced).toHaveLength(0);
    // The third card was never drawn.
    expect(state.deck).toHaveLength(1);
  });

  it('resolves a nested Flip Three first, then finishes the original sequence', () => {
    const state = makeGame(
      ['A', 'B'],
      [
        act('flip_three'), // p0 draws, targets p1
        num(2), // p1 forced draw 1
        act('flip_three'), // p1 forced draw 2 -> p1 must pick a target
        num(3), // (nested) p1 forced draw 1
        num(4), // (nested) p1 forced draw 2
        num(5), // (nested) p1 forced draw 3
        num(6), // p1's original forced draw 3
      ],
    );
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');
    runUntilInput(state);

    // p1 drew the nested Flip Three and now owes a target choice.
    expect(state.pending?.actorId).toBe('p1');
    expect(state.pending?.reason).toBe('flip_three');
    chooseTarget(state, 'p1', 'p1');
    runUntilInput(state);

    // Nested three (3,4,5) resolve before the original sequence's last card (6).
    expect(player(state, 'p1').numbers.map((c) => c.value)).toEqual([2, 3, 4, 5, 6]);
    expect(state.forced).toHaveLength(0);
  });

  it('resolves modifiers and Second Chance drawn mid-sequence', () => {
    const state = makeGame(
      ['A', 'B'],
      [act('flip_three'), x2(), act('second_chance'), num(11)],
    );
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');
    runUntilInput(state);

    const p1 = player(state, 'p1');
    expect(p1.modifiers).toHaveLength(1);
    expect(p1.secondChance).not.toBeNull();
    expect(p1.numbers.map((c) => c.value)).toEqual([11]);
  });

  it('is cut short when a Flip 7 completes mid-sequence', () => {
    const state = makeGame(['A', 'B'], [act('flip_three'), num(6), num(7), num(8)]);
    seed(state, 'p1', [1, 2, 3, 4, 5]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');
    runUntilInput(state);

    expect(state.flipSevenBy).toBe('p1');
    expect(state.forced).toHaveLength(0);
    // The 7th unique number ends it — the third forced card is never drawn.
    expect(player(state, 'p1').numbers).toHaveLength(0); // cleared at round end
    expect(state.phase).toBe('round_end');
  });

  it('can be aimed at yourself', () => {
    const state = makeGame(['A', 'B'], [act('flip_three'), num(2), num(3), num(4)]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p0');
    runUntilInput(state);
    expect(player(state, 'p0').numbers.map((c) => c.value)).toEqual([2, 3, 4]);
  });
});

describe('Flip 7', () => {
  it('ends the round immediately and awards the bonus', () => {
    const state = makeGame(['A', 'B'], [num(7)]);
    seed(state, 'p0', [1, 2, 3, 4, 5, 6]);
    seed(state, 'p1', [10]);

    hit(state, 'p0');
    expect(state.flipSevenBy).toBe('p0');
    runUntilInput(state);

    expect(state.phase).toBe('round_end');
    const rows = state.roundSummary!;
    const a = rows.find((r) => r.playerId === 'p0')!;
    // 1+2+3+4+5+6+7 = 28, plus the Flip 7 bonus.
    expect(a.base).toBe(28);
    expect(a.flipSevenBonus).toBe(FLIP_SEVEN_BONUS);
    expect(a.total).toBe(28 + FLIP_SEVEN_BONUS);

    // Everyone still active banks what they were holding.
    const b = rows.find((r) => r.playerId === 'p1')!;
    expect(b.total).toBe(10);
    expect(b.busted).toBe(false);
  });

  it('does not rescue a player who already busted', () => {
    const state = makeGame(['A', 'B'], [num(7)]);
    seed(state, 'p0', [1, 2, 3, 4, 5, 6]);
    seed(state, 'p1', [10]);
    player(state, 'p1').status = 'busted';

    hit(state, 'p0');
    runUntilInput(state);

    const b = state.roundSummary!.find((r) => r.playerId === 'p1')!;
    expect(b.busted).toBe(true);
    expect(b.total).toBe(0);
  });

  it('gives the bonus only to the player who completed it', () => {
    const state = makeGame(['A', 'B'], [num(7)]);
    seed(state, 'p0', [1, 2, 3, 4, 5, 6]);
    seed(state, 'p1', [1, 2, 3, 4, 5, 6]);
    hit(state, 'p0');
    runUntilInput(state);

    const rows = state.roundSummary!;
    expect(rows.find((r) => r.playerId === 'p0')!.flipSevenBonus).toBe(FLIP_SEVEN_BONUS);
    expect(rows.find((r) => r.playerId === 'p1')!.flipSevenBonus).toBe(0);
  });
});

describe('scoring', () => {
  const cases: Array<[string, number[], Card[], number]> = [
    ['plain numbers', [3, 9, 12], [], 24],
    ['x2 doubles the numbers only', [3, 9, 12], [x2()], 48],
    ['flat bonuses add after doubling', [3, 9, 12], [x2(), plus(4)], 52],
    ['multiple flat bonuses stack', [5, 5 + 1], [plus(2), plus(10)], 23],
    ['modifiers alone still score', [], [plus(6)], 6],
    ['a zero card is worth nothing but occupies a slot', [0, 4], [], 4],
  ];

  for (const [label, numbers, modifiers, expected] of cases) {
    it(label, () => {
      const state = makeGame(['A', 'B'], []);
      seed(state, 'p0', numbers, modifiers);
      expect(tableauScore(player(state, 'p0'))).toBe(expected);
    });
  }

  it('scores a busted player as zero regardless of modifiers', () => {
    const state = makeGame(['A', 'B'], []);
    seed(state, 'p0', [12, 11], [x2(), plus(10)]);
    player(state, 'p0').status = 'busted';
    expect(tableauScore(player(state, 'p0'))).toBe(0);

    endRound(state);
    const row = state.roundSummary!.find((r) => r.playerId === 'p0')!;
    expect(row.total).toBe(0);
    expect(row.busted).toBe(true);
  });

  it('accumulates round scores into the game total', () => {
    const state = makeGame(['A', 'B'], []);
    seed(state, 'p0', [10, 5]);
    endRound(state);
    expect(player(state, 'p0').totalScore).toBe(15);
    expect(player(state, 'p0').lastRoundScore).toBe(15);
  });

  it('clears every tableau into the discard pile at round end', () => {
    const state = makeGame(['A', 'B'], []);
    seed(state, 'p0', [10, 5], [x2()]);
    seed(state, 'p1', [3]);
    endRound(state);
    expect(state.discard).toHaveLength(4);
    expect(player(state, 'p0').numbers).toHaveLength(0);
    expect(player(state, 'p0').modifiers).toHaveLength(0);
  });
});

describe('win condition', () => {
  it('ends the game when someone crosses the target at round end', () => {
    const state = makeGame(['A', 'B'], [], { targetScore: 50 });
    player(state, 'p0').totalScore = 40;
    seed(state, 'p0', [12]);
    endRound(state);
    expect(state.phase).toBe('game_over');
    expect(state.winnerIds).toEqual(['p0']);
  });

  it('does not end the game mid-round', () => {
    const state = makeGame(['A', 'B'], [num(12)], { targetScore: 20 });
    player(state, 'p0').totalScore = 19;
    hit(state, 'p0');
    expect(state.phase).toBe('playing');
    expect(state.winnerIds).toHaveLength(0);
  });

  it('declares a shared win on an exact tie', () => {
    const state = makeGame(['A', 'B'], [], { targetScore: 30 });
    player(state, 'p0').totalScore = 25;
    player(state, 'p1').totalScore = 25;
    seed(state, 'p0', [10]);
    seed(state, 'p1', [10]);
    endRound(state);
    expect(state.phase).toBe('game_over');
    expect(state.winnerIds.sort()).toEqual(['p0', 'p1']);
  });

  it('awards the win to the higher score when both cross the line', () => {
    const state = makeGame(['A', 'B'], [], { targetScore: 30 });
    player(state, 'p0').totalScore = 25;
    player(state, 'p1').totalScore = 25;
    seed(state, 'p0', [12]);
    seed(state, 'p1', [10]);
    endRound(state);
    expect(state.winnerIds).toEqual(['p0']);
  });
});

describe('the opening deal', () => {
  it('deals one card to every player, starting to the dealer’s left', () => {
    const state = makeDealingGame(['A', 'B', 'C'], [num(2), num(3), num(4)]);
    expect(state.dealerIndex).toBe(0); // p0 deals round 1
    runUntilInput(state);

    // The deal goes p1, p2, then the dealer themselves.
    expect(player(state, 'p1').numbers.map((c) => c.value)).toEqual([2]);
    expect(player(state, 'p2').numbers.map((c) => c.value)).toEqual([3]);
    expect(player(state, 'p0').numbers.map((c) => c.value)).toEqual([4]);
    expect(state.phase).toBe('playing');
    // Turn order matches the deal, so the dealer's left acts first.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p1' });
  });

  it('resolves an Action card dealt during the opening deal before dealing on', () => {
    const state = makeDealingGame(['A', 'B', 'C'], [act('freeze'), num(3), num(4)]);
    // p1 is dealt first and gets the Freeze — it must resolve before p2 and p0
    // receive anything.
    runUntilInput(state);
    expect(state.pending?.actorId).toBe('p1');
    expect(player(state, 'p2').numbers).toHaveLength(0);
    expect(player(state, 'p0').numbers).toHaveLength(0);

    chooseTarget(state, 'p1', 'p2');
    runUntilInput(state);

    // Frozen mid-deal, p2 is skipped and never receives an opening card.
    expect(player(state, 'p2').status).toBe('stayed');
    expect(player(state, 'p2').numbers).toHaveLength(0);
    expect(player(state, 'p0').numbers.map((c) => c.value)).toEqual([3]);
  });

  it('rotates the dealer one seat each round', () => {
    const state = makeDealingGame(['A', 'B', 'C'], [num(2), num(3), num(4)]);
    expect(state.round).toBe(1);
    expect(state.dealerIndex).toBe(0);

    runUntilInput(state);
    for (const p of state.players) p.status = 'stayed';
    runUntilInput(state);
    expect(state.phase).toBe('round_end');

    state.deck = shuffle(buildDeck(), createRng(5));
    nextRound(state);
    expect(state.round).toBe(2);
    expect(state.dealerIndex).toBe(1);
  });
});

describe('leaving mid-game', () => {
  it('removes the seat and keeps the round going', () => {
    const state = makeGame(['A', 'B', 'C'], [num(5), num(9)]);
    seed(state, 'p1', [4, 6]);
    expect(removePlayer(state, 'p1').ok).toBe(true);

    expect(state.players.map((p) => p.id)).toEqual(['p0', 'p2']);
    expect(state.phase).toBe('playing');
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p0' });
  });

  it('returns the leaver’s cards to the discard pile', () => {
    const state = makeGame(['A', 'B'], []);
    seed(state, 'p1', [4, 6], [x2(), act('second_chance')]);
    removePlayer(state, 'p1');
    expect(state.discard).toHaveLength(4);
  });

  it('passes the turn on when the player on turn leaves', () => {
    const state = makeGame(['A', 'B', 'C'], [num(5)]);
    state.turnIndex = 1;
    removePlayer(state, 'p1');
    // p2 slid into the vacated slot and is now on turn.
    expect(waitingOn(state)).toEqual({ type: 'decision', playerId: 'p2' });
  });

  it('keeps the dealer indicator on the same seat', () => {
    const state = makeGame(['A', 'B', 'C'], []);
    state.dealerIndex = 2;
    removePlayer(state, 'p0');
    expect(state.players[state.dealerIndex].id).toBe('p2');
  });

  it('cancels a targeting prompt owned by the leaver', () => {
    const state = makeGame(['A', 'B', 'C'], [act('freeze')]);
    hit(state, 'p0');
    expect(state.pending?.actorId).toBe('p0');

    removePlayer(state, 'p0');
    expect(state.pending).toBeNull();
    expect(waitingOn(state)?.type).toBe('decision');
  });

  it('drops the leaver from a prompt aimed at them', () => {
    const state = makeGame(['A', 'B', 'C'], [act('freeze')]);
    hit(state, 'p0');
    removePlayer(state, 'p2');
    expect(state.pending?.targets).toEqual(['p0', 'p1']);
  });

  it('keeps a Freeze prompt alive while the actor can still target themselves', () => {
    const state = makeGame(['A', 'B'], [act('freeze')]);
    hit(state, 'p0');
    expect(state.pending?.targets.sort()).toEqual(['p0', 'p1']);

    removePlayer(state, 'p1');
    expect(state.pending?.targets).toEqual(['p0']);
    chooseTarget(state, 'p0', 'p0');
    expect(player(state, 'p0').status).toBe('stayed');
  });

  it('cancels a prompt once every legal target has left', () => {
    // A spare Second Chance can never be kept by the drawer, so removing the
    // other two players leaves it with nowhere to go.
    const state = makeGame(['A', 'B', 'C'], [act('second_chance')]);
    seed(state, 'p0', [], [act('second_chance')]);
    hit(state, 'p0');
    expect(state.pending?.targets.sort()).toEqual(['p1', 'p2']);

    removePlayer(state, 'p1');
    expect(state.pending?.targets).toEqual(['p2']);
    removePlayer(state, 'p2');

    expect(state.pending).toBeNull();
    expect(state.discard.some((c) => c.kind === 'action')).toBe(true);
  });

  it('cancels forced draws owed by the leaver', () => {
    const state = makeGame(['A', 'B'], [act('flip_three'), num(2), num(3), num(4)]);
    hit(state, 'p0');
    chooseTarget(state, 'p0', 'p1');
    expect(state.forced).toHaveLength(1);

    removePlayer(state, 'p1');
    expect(state.forced).toHaveLength(0);
  });

  it('hands the host role to another human', () => {
    const state = makeGame(['A', 'B'], []);
    state.hostId = 'p0';
    state.players[1].isBot = true;
    removePlayer(state, 'p0');
    expect(state.hostId).toBe('p1');
  });

  it('ends the game if the table empties', () => {
    const state = makeGame(['A'], []);
    removePlayer(state, 'p0');
    expect(state.players).toHaveLength(0);
    expect(state.phase).toBe('game_over');
  });

  it('rejects an unknown player', () => {
    const state = makeGame(['A', 'B'], []);
    expect(removePlayer(state, 'nobody').ok).toBe(false);
  });

  it('lets the round still finish and score after someone leaves', () => {
    const state = makeGame(['A', 'B', 'C'], []);
    seed(state, 'p0', [10]);
    seed(state, 'p2', [7]);
    removePlayer(state, 'p1');

    stay(state, 'p0');
    stay(state, 'p2');
    runUntilInput(state);

    expect(state.phase).toBe('round_end');
    expect(state.roundSummary?.map((r) => r.playerId)).toEqual(['p0', 'p2']);
    expect(player(state, 'p0').totalScore).toBe(10);
  });
});

describe('deck recycling', () => {
  it('reshuffles the discard pile when the draw pile runs out', () => {
    const state = makeGame(['A', 'B'], []);
    state.discard = [num(4), num(5), num(6)];
    const card = drawCard(state);
    expect(card).not.toBeNull();
    expect(state.discard).toHaveLength(0);
    expect(state.deck).toHaveLength(2);
  });

  it('returns null when there is genuinely nothing left', () => {
    const state = makeGame(['A', 'B'], []);
    expect(drawCard(state)).toBeNull();
  });
});

describe('engine settling', () => {
  it('never wedges: a full random round always reaches a terminal state', () => {
    // Fuzz the state machine — whatever the deck throws up, it must either
    // finish the round or ask a specific player for input, never spin.
    for (let run = 0; run < 60; run++) {
      const state = makeDealingGame(['A', 'B', 'C', 'D'], []);
      state.deck = shuffle(buildDeck(), createRng(run + 1));

      let guard = 0;
      while (state.phase !== 'round_end' && state.phase !== 'game_over' && guard++ < 500) {
        const wait = waitingOn(state);
        if (wait === null) {
          tick(state);
        } else if (wait.type === 'decision') {
          const p = player(state, wait.playerId);
          if (p.numbers.length >= 3) stay(state, wait.playerId);
          else hit(state, wait.playerId);
        } else if (wait.type === 'target') {
          chooseTarget(state, wait.playerId, state.pending!.targets[0]);
        } else {
          break;
        }
      }
      expect(guard).toBeLessThan(500);
      expect(['round_end', 'game_over']).toContain(state.phase);
    }
  });
});
