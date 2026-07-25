import { FLIP_SEVEN_COUNT } from '@shared/game/cards';
import { tableauScore } from '@shared/game/engine';
import type { GameState, PlayerState } from '@shared/game/types';

import { PlayingCard } from './PlayingCard';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'In play', className: 'border-marquee/70 text-marquee' },
  stayed: { label: 'Banked', className: 'border-emerald-400/70 text-emerald-300' },
  busted: { label: 'Busted', className: 'border-tomato/70 text-tomato-light' },
};

export interface PlayerPanelProps {
  player: PlayerState;
  state: GameState;
  isMe: boolean;
  isCurrent: boolean;
  isDealer: boolean;
  /** Card id that just landed here — gets the flip animation + ring. */
  flashCardId: string | null;
  /** Renders the panel as a tappable target during action-card targeting. */
  targetable?: boolean;
  onTarget?: (playerId: string) => void;
  /** Shake the panel on a bust. */
  busting?: boolean;
}

export function PlayerPanel({
  player,
  state,
  isMe,
  isCurrent,
  isDealer,
  flashCardId,
  targetable = false,
  onTarget,
  busting = false,
}: PlayerPanelProps) {
  const status = STATUS_STYLES[player.status] ?? STATUS_STYLES.active;
  const roundValue = tableauScore(player);
  const forcedDraws = state.forced.filter((f) => f.playerId === player.id);
  const forcedRemaining = forcedDraws.reduce((n, f) => n + f.remaining, 0);
  const cardSize = isMe ? 'md' : 'sm';
  const bustValue = player.bustedBy?.value ?? null;

  const Wrapper = targetable ? 'button' : 'div';

  return (
    <Wrapper
      {...(targetable
        ? {
            type: 'button' as const,
            onClick: () => onTarget?.(player.id),
            'aria-label': `Target ${player.name}`,
          }
        : {})}
      className={[
        'relative w-full rounded-2xl border-2 p-2.5 text-left transition',
        isMe ? 'bg-teal-900/80' : 'bg-teal-900/50',
        isCurrent ? 'border-marquee shadow-glow' : 'border-ink/45',
        // Dim a busted player, but not so far that the evidence is unreadable.
        player.status === 'busted' ? 'opacity-80' : '',
        targetable
          ? 'cursor-pointer border-frost ring-2 ring-frost/60 hover:bg-frost/20 active:scale-[0.98]'
          : '',
        busting ? 'animate-shake' : '',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        {isDealer && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-[10px] text-ink"
            title="Dealer"
            aria-label="Dealer"
          >
            D
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide">
          {player.name}
          {isMe && <span className="ml-1 text-marquee">(you)</span>}
        </span>

        {!player.connected && !player.isBot && (
          <span className="rounded-full border border-cream/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-cream/50">
            Away
          </span>
        )}

        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Score row */}
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="rounded-lg bg-black/25 px-2 py-1">
          <span className="text-cream/60">Total </span>
          <span className="font-display text-sm text-cream">{player.totalScore}</span>
        </span>
        <span
          className={`rounded-lg px-2 py-1 ${
            player.status === 'busted' ? 'bg-tomato/25' : 'bg-marquee/20'
          }`}
        >
          <span className="text-cream/60">Round </span>
          <span
            className={`font-display text-sm ${
              player.status === 'busted' ? 'text-tomato-light line-through' : 'text-marquee'
            }`}
          >
            {roundValue}
          </span>
        </span>
        <span className="ml-auto text-[11px] text-cream/50">
          {player.numbers.length}/{FLIP_SEVEN_COUNT}
        </span>
      </div>

      {/* Flip 7 progress pips */}
      <div className="mb-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: FLIP_SEVEN_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < player.numbers.length ? 'bg-marquee' : 'bg-cream/15'
            }`}
          />
        ))}
      </div>

      {/* Tableau */}
      <div className="flex flex-wrap items-start gap-1.5">
        {player.numbers.length === 0 &&
          player.modifiers.length === 0 &&
          !player.secondChance &&
          !player.bustedBy && (
            <span className="py-3 text-xs italic text-cream/35">No cards yet</span>
          )}

        {player.numbers.map((card) => (
          <PlayingCard
            key={card.id}
            card={card}
            size={cardSize}
            animate={card.id === flashCardId}
            // Ring the number that the busting card matched.
            highlight={card.id === flashCardId || card.value === bustValue}
          />
        ))}
        {player.modifiers.map((card) => (
          <PlayingCard
            key={card.id}
            card={card}
            size={cardSize}
            animate={card.id === flashCardId}
            highlight={card.id === flashCardId}
          />
        ))}
        {player.secondChance && (
          <PlayingCard
            key={player.secondChance.id}
            card={player.secondChance}
            size={cardSize}
            animate={player.secondChance.id === flashCardId}
            highlight={player.secondChance.id === flashCardId}
          />
        )}

        {/* The card that did the damage, set apart from the tableau it broke. */}
        {player.bustedBy && (
          <div className="relative ml-1 border-l-2 border-dashed border-tomato/50 pl-2.5">
            <PlayingCard
              card={player.bustedBy}
              size={cardSize}
              animate={player.bustedBy.id === flashCardId}
              className="ring-4 ring-tomato ring-offset-2 ring-offset-teal-900"
            />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-tomato text-[10px] font-bold text-cream">
              ✕
            </span>
          </div>
        )}
      </div>

      {player.bustedBy && (
        <p className="mt-2 rounded-lg border-2 border-tomato/60 bg-tomato/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-cream">
          Busted on a second {player.bustedBy.value}
        </p>
      )}

      {/* Flip Three counter */}
      {forcedRemaining > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border-2 border-grape/70 bg-grape/25 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-cream">
          <span className="animate-pulse">⚡</span>
          Flip Three — {forcedRemaining} card{forcedRemaining === 1 ? '' : 's'} to go
        </div>
      )}
    </Wrapper>
  );
}
