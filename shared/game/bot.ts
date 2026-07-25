/**
 * Heuristic bot player.
 *
 * Flip 7 is a public-information game, so the bot is allowed to reason from
 * everything on the table. It counts which number cards are still unseen
 * (full deck composition minus every visible tableau), turns that into a bust
 * probability, and compares the expected value of hitting against the points it
 * would forfeit. It does not peek at deck order.
 */

import { FLIP_SEVEN_BONUS, FLIP_SEVEN_COUNT, fullNumberCounts } from './cards.js';
import { activePlayers, tableauScore } from './engine.js';
import type { GameState, PendingTarget, PlayerState } from './types.js';

export interface BotOdds {
  /** Chance the next card busts this player outright. */
  bustChance: number;
  /** Chance the next card is a duplicate at all (before Second Chance). */
  duplicateChance: number;
  /** Average value of an unseen number card. */
  averageCardValue: number;
  /** Chance the next card is a number card (vs action/modifier). */
  numberChance: number;
}

/** Counts number cards still unseen — i.e. not sitting face-up in any tableau. */
function unseenNumberCounts(state: GameState): Map<number, number> {
  const counts = fullNumberCounts();
  for (const p of state.players) {
    for (const card of p.numbers) {
      counts.set(card.value, (counts.get(card.value) ?? 0) - 1);
    }
    // A busted player's cards stay face-up until the round is scored, so the
    // card that busted them is visible information too.
    if (p.bustedBy) {
      counts.set(p.bustedBy.value, (counts.get(p.bustedBy.value) ?? 0) - 1);
    }
  }
  return counts;
}

export function computeOdds(state: GameState, player: PlayerState): BotOdds {
  const counts = unseenNumberCounts(state);

  let unseenNumbers = 0;
  let weightedValue = 0;
  for (const [value, count] of counts) {
    const c = Math.max(0, count);
    unseenNumbers += c;
    weightedValue += c * value;
  }

  // Every card not face-up in a tableau is still "out there" — the deck plus the
  // discard pile, since the discard gets reshuffled in when the deck runs dry.
  const pool = state.deck.length + state.discard.length;

  if (pool === 0) {
    return { bustChance: 0, duplicateChance: 0, averageCardValue: 0, numberChance: 0 };
  }

  const held = new Set(player.numbers.map((c) => c.value));
  let dupes = 0;
  for (const value of held) dupes += Math.max(0, counts.get(value) ?? 0);

  const duplicateChance = dupes / pool;
  // A Second Chance eats the first duplicate, so the immediate bust risk is zero.
  const bustChance = player.secondChance ? 0 : duplicateChance;

  return {
    bustChance,
    duplicateChance,
    averageCardValue: unseenNumbers > 0 ? weightedValue / unseenNumbers : 0,
    numberChance: unseenNumbers / pool,
  };
}

/**
 * Decide whether to hit. Roughly an expected-value comparison:
 *
 *   EV(hit) ≈ (upside if we survive) − bustChance × (points we'd throw away)
 *
 * with a few positional adjustments — protect an x2, chase the Flip 7 when
 * you're one card away, and gamble harder when you're losing badly.
 */
export function shouldHit(state: GameState, player: PlayerState): boolean {
  const odds = computeOdds(state, player);
  const atStake = tableauScore(player, false);
  const hasX2 = player.modifiers.some((m) => m.modifier === 'x2');
  const cardsHeld = player.numbers.length;

  // Free roll: nothing to lose yet.
  if (atStake === 0 && cardsHeld === 0) return true;

  // A Second Chance means the next duplicate costs us nothing — take the card.
  if (player.secondChance && odds.duplicateChance < 0.6) return true;

  // Banking this would win the game outright — take it.
  if (player.totalScore + atStake >= state.settings.targetScore) return false;

  // One card away from Flip 7: the +15 and the doubled tableau usually justify it.
  const oneAwayFromFlipSeven = cardsHeld === FLIP_SEVEN_COUNT - 1;

  let upside = odds.averageCardValue * odds.numberChance;
  if (hasX2) upside *= 2;
  if (oneAwayFromFlipSeven) {
    // Surviving here also banks the bonus and ends the round on our terms.
    upside += (1 - odds.bustChance) * FLIP_SEVEN_BONUS * 0.8;
  }

  const downside = odds.bustChance * (hasX2 ? atStake * 1.35 : atStake);

  // Catch-up aggression: if we're well behind the leader, accept worse odds.
  const leader = Math.max(...state.players.map((p) => p.totalScore));
  const deficit = leader - player.totalScore;
  const desperation = Math.min(0.5, Math.max(0, deficit - 25) / 200);

  const ev = upside - downside * (1 - desperation);

  // Hard brake: never push past a coin flip on a big pile.
  if (odds.bustChance > 0.5 && atStake >= 18) return false;

  return ev > 0;
}

/** Picks a target for a pending Freeze / Flip Three / Second Chance pass. */
export function chooseBotTarget(
  state: GameState,
  bot: PlayerState,
  pending: PendingTarget,
): string {
  const candidates = pending.targets
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is PlayerState => Boolean(p));

  if (candidates.length === 0) return pending.targets[0];

  const opponents = candidates.filter((p) => p.id !== bot.id);
  const self = candidates.find((p) => p.id === bot.id);

  if (pending.reason === 'second_chance_pass') {
    // Hand it to whoever it helps least: the player furthest from winning.
    return [...candidates].sort((a, b) => a.totalScore - b.totalScore)[0].id;
  }

  if (pending.reason === 'freeze') {
    // Freezing yourself is right when you're sitting on a fat, fragile tableau.
    if (self) {
      const myOdds = computeOdds(state, self);
      const mine = tableauScore(self, false);
      if (mine >= 20 && myOdds.bustChance > 0.3) return self.id;
      if (self.totalScore + mine >= state.settings.targetScore) return self.id;
    }
    if (opponents.length === 0) return candidates[0].id;
    // Otherwise shut down whoever has the most to lose / is closest to winning.
    return [...opponents].sort(
      (a, b) =>
        threatScore(state, b) - threatScore(state, a),
    )[0].id;
  }

  // Flip Three. Three free cards is a gift when your tableau is nearly empty and
  // the deck is still friendly; it's a weapon aimed at a crowded tableau.
  if (self) {
    const myOdds = computeOdds(state, self);
    if (self.numbers.length <= 2 && myOdds.bustChance < 0.18) return self.id;
    if (self.secondChance && self.numbers.length <= 3 && myOdds.duplicateChance < 0.3) {
      return self.id;
    }
  }
  if (opponents.length === 0) return candidates[0].id;

  return [...opponents].sort((a, b) => {
    const oa = computeOdds(state, a);
    const ob = computeOdds(state, b);
    // Prefer the opponent most likely to blow up; break ties by who's winning.
    const risk = ob.bustChance - oa.bustChance;
    if (Math.abs(risk) > 0.02) return risk;
    return threatScore(state, b) - threatScore(state, a);
  })[0].id;
}

/** How dangerous an opponent is right now: banked points plus what they're holding. */
function threatScore(state: GameState, player: PlayerState): number {
  return player.totalScore * 0.5 + tableauScore(player, false);
}

/** Human-readable reason, shown in the log so bot play is legible while testing. */
export function describeBotDecision(state: GameState, player: PlayerState): string {
  const odds = computeOdds(state, player);
  return `${Math.round(odds.bustChance * 100)}% bust risk on ${tableauScore(player, false)} pts`;
}
