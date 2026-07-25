import type { Card } from '@shared/game/types';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, string> = {
  xs: 'w-8 h-11 text-lg rounded-md',
  sm: 'w-11 h-16 text-2xl',
  md: 'w-14 h-20 text-3xl sm:w-16 sm:h-24 sm:text-4xl',
  lg: 'w-24 h-36 text-6xl',
};

/**
 * Each number gets its own hue, mirroring the physical deck. It also makes a
 * duplicate jump out at a glance, which is the whole tension of the game.
 */
const NUMBER_COLORS: Record<number, { bg: string; ink: string }> = {
  0: { bg: '#F7F1E1', ink: '#0D2B3A' },
  1: { bg: '#D9EDF7', ink: '#12546E' },
  2: { bg: '#BFE3F5', ink: '#0F4F6B' },
  3: { bg: '#A9DDD4', ink: '#0B5A50' },
  4: { bg: '#9BD9A8', ink: '#14562A' },
  5: { bg: '#CFE38C', ink: '#4A5A10' },
  6: { bg: '#F2E07A', ink: '#5E4A05' },
  7: { bg: '#F9BE3B', ink: '#5A3A02' },
  8: { bg: '#F79B4D', ink: '#6B3105' },
  9: { bg: '#F2764F', ink: '#6E2409' },
  10: { bg: '#E2452C', ink: '#FFF3EA' },
  11: { bg: '#C93A6B', ink: '#FFEAF1' },
  12: { bg: '#7C5CC4', ink: '#F1EBFF' },
};

const ACTION_THEME = {
  freeze: { bg: '#5AB4E8', ink: '#06304A', label: 'Freeze' },
  flip_three: { bg: '#7C5CC4', ink: '#F3EEFF', label: 'Flip 3' },
  second_chance: { bg: '#3FA96B', ink: '#EAFBF0', label: '2nd Chance' },
} as const;

function SnowflakeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
      <path d="M12 5.5 9.5 8M12 5.5 14.5 8M12 18.5 9.5 16M12 18.5 14.5 16" />
      <path d="M5.5 12 8 9.5M5.5 12 8 14.5M18.5 12 16 9.5M18.5 12 16 14.5" />
    </svg>
  );
}

function FlipThreeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="9" height="13" rx="1.6" />
      <rect x="8" y="4" width="9" height="13" rx="1.6" opacity="0.75" />
      <rect x="13.5" y="2" width="8" height="13" rx="1.6" opacity="0.5" />
    </svg>
  );
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 20 6v6c0 4.6-3.2 8.3-8 9.5-4.8-1.2-8-4.9-8-9.5V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

export interface PlayingCardProps {
  card: Card;
  size?: CardSize;
  /** Adds the flip-in animation (used when a card has just landed). */
  animate?: boolean;
  /** Dims the card, e.g. for a discarded duplicate. */
  faded?: boolean;
  /** Yellow ring, used to highlight the card that just arrived. */
  highlight?: boolean;
  className?: string;
}

export function PlayingCard({
  card,
  size = 'md',
  animate = false,
  faded = false,
  highlight = false,
  className = '',
}: PlayingCardProps) {
  const base = `card-face font-display ${SIZES[size]} ${
    animate ? 'animate-flip-in' : ''
  } ${faded ? 'opacity-40 grayscale' : ''} ${
    highlight ? 'ring-4 ring-marquee ring-offset-2 ring-offset-teal-900' : ''
  } ${className}`;

  const iconSize = size === 'lg' ? 'w-10 h-10' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4';
  const captionSize = size === 'lg' ? 'text-[11px]' : 'text-[7px] sm:text-[8px]';

  if (card.kind === 'number') {
    const theme = NUMBER_COLORS[card.value] ?? NUMBER_COLORS[0];
    return (
      <div
        className={base}
        style={{ backgroundColor: theme.bg, color: theme.ink }}
        role="img"
        aria-label={`Number card ${card.value}`}
      >
        {/* Corner pips echo the physical card layout. */}
        <span className={`absolute left-1 top-0.5 ${captionSize} opacity-70`}>
          {card.value}
        </span>
        <span className="leading-none">{card.value}</span>
        <span className={`absolute bottom-0.5 right-1 rotate-180 ${captionSize} opacity-70`}>
          {card.value}
        </span>
      </div>
    );
  }

  if (card.kind === 'modifier') {
    const isX2 = card.modifier === 'x2';
    const bg = isX2 ? '#F9BE3B' : '#E2452C';
    const ink = isX2 ? '#5A3A02' : '#FFF3EA';
    const label = isX2 ? '×2' : `+${card.value}`;
    return (
      <div
        className={base}
        style={{ backgroundColor: bg, color: ink }}
        role="img"
        aria-label={isX2 ? 'Double modifier card' : `Plus ${card.value} modifier card`}
      >
        <span className="leading-none">{label}</span>
        <span className={`mt-0.5 uppercase tracking-widest ${captionSize} opacity-80`}>
          {isX2 ? 'Double' : 'Bonus'}
        </span>
        {/* Starburst corner to separate modifiers from numbers at a glance. */}
        <span className="absolute -right-1 -top-1 h-3 w-3 rotate-45 border-2 border-ink"
              style={{ backgroundColor: bg }} />
      </div>
    );
  }

  const theme = ACTION_THEME[card.action];
  const Icon =
    card.action === 'freeze'
      ? SnowflakeIcon
      : card.action === 'flip_three'
        ? FlipThreeIcon
        : ShieldIcon;

  return (
    <div
      className={base}
      style={{ backgroundColor: theme.bg, color: theme.ink }}
      role="img"
      aria-label={`${theme.label} action card`}
    >
      <Icon className={iconSize} />
      <span className={`mt-1 px-0.5 text-center uppercase leading-tight tracking-wide ${captionSize}`}>
        {theme.label}
      </span>
    </div>
  );
}

/** Face-down card, used for the draw pile. */
export function CardBack({ size = 'md', className = '' }: { size?: CardSize; className?: string }) {
  return (
    <div
      className={`card-face ${SIZES[size]} bg-teal-600 ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 4px, transparent 4px 9px)',
      }}
      aria-hidden="true"
    >
      <span className="font-display text-cream/80 text-outline-thin"
            style={{ fontSize: '0.55em' }}>
        7
      </span>
    </div>
  );
}
