import { ACTION_LABELS } from '@shared/game/cards';
import { tableauScore } from '@shared/game/engine';
import type { GameState } from '@shared/game/types';

import { PlayingCard } from './PlayingCard';

const REASON_COPY = {
  freeze: {
    title: 'Freeze someone',
    hint: 'They bank their points immediately and are done for the round.',
  },
  flip_three: {
    title: 'Flip Three',
    hint: 'They must draw three cards, one at a time. Bold move either way.',
  },
  second_chance_pass: {
    title: 'Pass your Second Chance',
    hint: 'You already hold one, so this copy goes to another player.',
  },
} as const;

export interface TargetPromptProps {
  state: GameState;
  meId: string;
  onChoose: (targetId: string) => void;
}

/**
 * The bottom sheet shown to whoever drew a targeted Action card. Everyone else
 * sees the waiting variant so the table knows why play has paused.
 */
export function TargetPrompt({ state, meId, onChoose }: TargetPromptProps) {
  const pending = state.pending;
  if (!pending) return null;

  const actor = state.players.find((p) => p.id === pending.actorId);
  const isMine = pending.actorId === meId;
  const copy = REASON_COPY[pending.reason];

  if (!isMine) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border-2 border-frost/70 bg-teal-900/95 px-4 py-3 shadow-card">
          <PlayingCard card={pending.card} size="sm" />
          <p className="text-sm">
            <span className="font-display uppercase tracking-wide text-frost">
              {actor?.name ?? 'Someone'}
            </span>{' '}
            drew {ACTION_LABELS[pending.card.action]} and is choosing a target…
          </p>
        </div>
      </div>
    );
  }

  const targets = pending.targets
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="animate-pop-in mx-auto w-full max-w-lg rounded-t-3xl border-4 border-frost bg-teal-800 p-4 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <PlayingCard card={pending.card} size="md" animate />
          <div className="min-w-0">
            <h2 className="font-display text-xl uppercase tracking-wide text-frost">
              {copy.title}
            </h2>
            <p className="text-sm text-cream/80">{copy.hint}</p>
          </div>
        </div>

        <p className="mb-2 font-display text-xs uppercase tracking-widest text-marquee">
          Choose a target
        </p>

        <div className="scrollbar-none grid max-h-[45dvh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {targets.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onChoose(player.id)}
              className="flex min-h-[60px] items-center gap-3 rounded-xl border-2 border-frost/70 bg-teal-900/70 px-3 py-2 text-left transition active:scale-[0.98] active:bg-frost/25"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm uppercase tracking-wide">
                  {player.name}
                  {player.id === meId && <span className="ml-1 text-marquee">(you)</span>}
                </span>
                <span className="text-[11px] text-cream/60">
                  {player.numbers.length} number{player.numbers.length === 1 ? '' : 's'} ·{' '}
                  {tableauScore(player)} pts this round · {player.totalScore} total
                </span>
              </span>
              {player.secondChance && (
                <span className="rounded-full border border-emerald-400/70 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                  2nd
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
