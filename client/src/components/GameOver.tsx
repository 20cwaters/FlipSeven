import type { GameState } from '@shared/game/types';

import { Modal } from './Modal';

const CONFETTI_COLORS = ['#F9BE3B', '#E2452C', '#5AB4E8', '#3FA96B', '#7C5CC4'];

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="absolute block h-3 w-2 animate-confetti rounded-sm"
          style={{
            left: `${(i * 2.5 + (i % 7) * 3) % 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.16}s`,
            animationDuration: `${2.2 + (i % 5) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}

export interface GameOverProps {
  state: GameState;
  meId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function GameOver({ state, meId, onPlayAgain, onLeave }: GameOverProps) {
  const winners = state.players.filter((p) => state.winnerIds.includes(p.id));
  const iWon = state.winnerIds.includes(meId);
  const isHost = state.hostId === meId;
  const ranked = [...state.players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <>
      {iWon && <Confetti />}
      <Modal
        open
        dismissible={false}
        title={iWon ? 'You win!' : 'Game over'}
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1 text-sm" onClick={onLeave}>
              Leave
            </button>
            {isHost && (
              <button type="button" className="btn-primary flex-[2]" onClick={onPlayAgain}>
                Play again
              </button>
            )}
          </div>
        }
      >
        <p className="mb-4 text-center">
          <span className="block font-display text-3xl uppercase tracking-wide text-marquee text-outline-thin">
            {winners.map((w) => w.name).join(' & ')}
          </span>
          <span className="text-sm text-cream/70">
            reached {state.settings.targetScore} in {state.round} round
            {state.round === 1 ? '' : 's'}
          </span>
        </p>

        <div className="space-y-2">
          {ranked.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                state.winnerIds.includes(player.id)
                  ? 'border-marquee bg-marquee/15'
                  : 'border-ink/40 bg-teal-900/60'
              }`}
            >
              <span className="w-5 text-center font-display text-sm text-cream/60">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide">
                {player.name}
                {player.id === meId && <span className="ml-1 text-marquee">(you)</span>}
              </span>
              <span className="font-display text-xl text-cream">{player.totalScore}</span>
            </div>
          ))}
        </div>

        {!isHost && (
          <p className="mt-4 text-center text-xs text-cream/60">
            Waiting for the host to start a rematch…
          </p>
        )}
      </Modal>
    </>
  );
}
