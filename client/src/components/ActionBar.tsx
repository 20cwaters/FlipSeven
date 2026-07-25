import { FLIP_SEVEN_COUNT } from '@shared/game/cards';
import { computeOdds } from '@shared/game/bot';
import { tableauScore } from '@shared/game/engine';
import type { GameState, PlayerState, WaitingOn } from '@shared/game/types';

export interface ActionBarProps {
  state: GameState;
  me: PlayerState | undefined;
  waiting: WaitingOn;
  onHit: () => void;
  onStay: () => void;
}

/**
 * Sticky bottom bar. Shows the decision buttons when it's your turn, and an
 * honest status line the rest of the time so the table never feels frozen.
 */
export function ActionBar({ state, me, waiting, onHit, onStay }: ActionBarProps) {
  const myTurn = waiting?.type === 'decision' && waiting.playerId === me?.id;

  if (!me) return null;

  if (!myTurn) {
    return (
      <div className="sticky bottom-0 z-30 border-t-2 border-ink/50 bg-teal-900/95 px-3 py-3 backdrop-blur">
        <p className="mx-auto max-w-lg text-center text-sm text-cream/75">
          {statusLine(state, me, waiting)}
        </p>
      </div>
    );
  }

  const potential = tableauScore(me);
  const odds = computeOdds(state, me);
  const bustPct = Math.round(odds.bustChance * 100);
  const oneAway = me.numbers.length === FLIP_SEVEN_COUNT - 1;

  const riskTone =
    bustPct >= 45 ? 'text-tomato-light' : bustPct >= 22 ? 'text-marquee' : 'text-emerald-300';

  return (
    <div className="sticky bottom-0 z-30 border-t-2 border-marquee/60 bg-teal-900/97 px-3 pb-3 pt-2 backdrop-blur">
      <div className="mx-auto max-w-lg">
        <div className="mb-2 flex items-center justify-center gap-4 text-xs">
          <span>
            <span className="text-cream/60">Banking now: </span>
            <span className="font-display text-lg text-marquee">{potential}</span>
          </span>
          <span aria-hidden="true" className="text-cream/25">
            |
          </span>
          <span>
            <span className="text-cream/60">Bust risk: </span>
            <span className={`font-display text-lg ${riskTone}`}>{bustPct}%</span>
          </span>
        </div>

        {oneAway && (
          <p className="mb-2 text-center font-display text-[11px] uppercase tracking-widest text-marquee">
            One card from Flip {FLIP_SEVEN_COUNT}
          </p>
        )}
        {me.secondChance && (
          <p className="mb-2 text-center text-[11px] text-emerald-300">
            Second Chance protects you from the next duplicate.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onHit}
            className="btn-danger min-h-[58px] text-xl animate-pulse-ring"
          >
            Hit
          </button>
          <button type="button" onClick={onStay} className="btn-teal min-h-[58px] text-xl">
            Stay
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-cream/45">
          One card per turn — play passes on after you flip.
        </p>
      </div>
    </div>
  );
}

function statusLine(state: GameState, me: PlayerState, waiting: WaitingOn): string {
  if (state.phase === 'round_end') return 'Round scored — next round starting…';
  if (state.phase === 'dealing') return 'Dealing…';

  if (waiting?.type === 'target') {
    const actor = state.players.find((p) => p.id === waiting.playerId);
    return `${actor?.name ?? 'Someone'} is choosing a target…`;
  }
  if (waiting?.type === 'decision') {
    const actor = state.players.find((p) => p.id === waiting.playerId);
    return `${actor?.name ?? 'Someone'} is deciding…`;
  }

  if (state.forced.length > 0) {
    const top = state.forced[state.forced.length - 1];
    const target = state.players.find((p) => p.id === top.playerId);
    return `${target?.name ?? 'Someone'} is flipping ${top.remaining} more…`;
  }

  if (me.status === 'busted') return 'You busted — sit tight for the next round.';
  if (me.status === 'stayed') return `You banked ${me.lastRoundScore ?? tableauScore(me)}. Nice.`;
  return 'Waiting…';
}
