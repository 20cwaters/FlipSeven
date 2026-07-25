import { FLIP_SEVEN_COUNT } from '@shared/game/cards';
import type { GameState } from '@shared/game/types';

import { Modal } from './Modal';

export interface RoundSummaryProps {
  state: GameState;
  meId: string;
  open: boolean;
  onNextRound: () => void;
  onClose: () => void;
}

export function RoundSummary({ state, meId, open, onNextRound, onClose }: RoundSummaryProps) {
  const rows = state.roundSummary;
  if (!rows) return null;

  const ranked = [...rows].sort((a, b) => b.newTotal - a.newTotal);
  const flipSevenName = state.flipSevenBy
    ? state.players.find((p) => p.id === state.flipSevenBy)?.name
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Round ${state.round} scored`}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1 text-sm" onClick={onClose}>
            View table
          </button>
          <button type="button" className="btn-primary flex-[2]" onClick={onNextRound}>
            Next round
          </button>
        </div>
      }
    >
      {flipSevenName && (
        <p className="mb-3 rounded-xl border-2 border-marquee bg-marquee/20 px-3 py-2 text-center font-display text-sm uppercase tracking-wide text-marquee">
          Flip {FLIP_SEVEN_COUNT}! {flipSevenName} ended the round early.
        </p>
      )}

      <div className="space-y-2">
        {ranked.map((row, index) => {
          const isMe = row.playerId === meId;
          return (
            <div
              key={row.playerId}
              className={`rounded-xl border-2 px-3 py-2 ${
                isMe ? 'border-marquee/70 bg-marquee/10' : 'border-ink/40 bg-teal-900/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center font-display text-xs text-cream/50">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide">
                  {row.name}
                  {isMe && <span className="ml-1 text-marquee">(you)</span>}
                </span>
                <span
                  className={`font-display text-lg ${
                    row.busted ? 'text-tomato-light' : 'text-marquee'
                  }`}
                >
                  {row.busted ? 'BUST' : `+${row.total}`}
                </span>
                <span className="w-14 shrink-0 text-right font-display text-lg text-cream">
                  {row.newTotal}
                </span>
              </div>

              {!row.busted && row.total > 0 && (
                <p className="ml-7 mt-0.5 text-[11px] text-cream/60">
                  {row.base} from cards
                  {row.doubled && <span className="text-marquee"> ×2 = {row.base * 2}</span>}
                  {row.bonus > 0 && <span> · +{row.bonus} bonus</span>}
                  {row.flipSevenBonus > 0 && (
                    <span className="text-marquee"> · +{row.flipSevenBonus} Flip {FLIP_SEVEN_COUNT}</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-cream/50">
        Playing to {state.settings.targetScore}. Next round starts automatically.
      </p>
    </Modal>
  );
}
