import { useEffect, useRef, useState } from 'react';

import { FLIP_SEVEN_BONUS, FLIP_SEVEN_COUNT } from '@shared/game/cards';
import type { Card, GameState } from '@shared/game/types';

import { PlayingCard } from './PlayingCard';

type Moment =
  | { kind: 'bust'; id: number; name: string; card: Card }
  | { kind: 'flip7'; id: number; name: string }
  | { kind: 'saved'; id: number; name: string; card: Card };

/** Long enough to actually read the card that landed. */
const DURATION_MS = 2800;

/**
 * Big transient callouts for the dramatic beats — busts, Flip 7s, and a Second
 * Chance save. Driven off `state.flash`, which the server stamps with a fresh
 * sequence number every time a card lands.
 */
export function Moments({ state }: { state: GameState }) {
  const [moment, setMoment] = useState<Moment | null>(null);
  const lastFlash = useRef(0);
  const lastFlipSeven = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const show = (next: Moment) => {
      setMoment(next);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMoment(null), DURATION_MS);
    };

    // Flip 7 outranks everything else that could have happened on the same card.
    if (state.flipSevenBy && state.flipSevenBy !== lastFlipSeven.current) {
      lastFlipSeven.current = state.flipSevenBy;
      const name = state.players.find((p) => p.id === state.flipSevenBy)?.name ?? 'Someone';
      show({ kind: 'flip7', id: Date.now(), name });
      return;
    }
    if (!state.flipSevenBy) lastFlipSeven.current = null;

    const flash = state.flash;
    if (!flash || flash.seq === lastFlash.current) return;
    lastFlash.current = flash.seq;

    const name = state.players.find((p) => p.id === flash.playerId)?.name ?? 'Someone';
    if (flash.busted) show({ kind: 'bust', id: flash.seq, name, card: flash.card });
    else if (flash.savedBySecondChance) {
      show({ kind: 'saved', id: flash.seq, name, card: flash.card });
    }
  }, [state]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!moment) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      {moment.kind === 'bust' && (
        <div className="animate-rise-fade text-center">
          <div className="mb-3 flex justify-center">
            <div className="animate-shake">
              <PlayingCard
                card={moment.card}
                size="lg"
                className="ring-4 ring-tomato ring-offset-4 ring-offset-teal-900/0"
              />
            </div>
          </div>
          <p className="font-display text-6xl uppercase tracking-tight text-tomato text-outline sm:text-8xl">
            Bust!
          </p>
          <p className="mt-1 font-display text-lg uppercase tracking-widest text-cream text-outline-thin">
            {moment.name} drew a second{' '}
            {moment.card.kind === 'number' ? moment.card.value : 'card'}
          </p>
        </div>
      )}

      {moment.kind === 'flip7' && (
        <div className="animate-rise-fade text-center">
          <div className="mb-3 flex justify-center gap-1">
            {[1, 4, 7, 9, 11, 12, 3].map((v, i) => (
              <div key={v} style={{ transform: `rotate(${(i - 3) * 7}deg)` }}>
                <PlayingCard
                  card={{ id: `moment-${v}`, kind: 'number', value: v }}
                  size="xs"
                />
              </div>
            ))}
          </div>
          <p className="font-display text-6xl uppercase tracking-tight text-marquee text-outline sm:text-8xl">
            Flip {FLIP_SEVEN_COUNT}!
          </p>
          <p className="mt-1 font-display text-lg uppercase tracking-widest text-cream text-outline-thin">
            {moment.name} takes +{FLIP_SEVEN_BONUS}
          </p>
        </div>
      )}

      {moment.kind === 'saved' && (
        <div className="animate-rise-fade text-center">
          <div className="mb-3 flex justify-center">
            <PlayingCard
              card={moment.card}
              size="lg"
              className="ring-4 ring-emerald-400 ring-offset-4 ring-offset-teal-900/0"
            />
          </div>
          <p className="font-display text-4xl uppercase tracking-tight text-emerald-300 text-outline sm:text-6xl">
            Second Chance!
          </p>
          <p className="mt-1 font-display text-base uppercase tracking-widest text-cream text-outline-thin">
            {moment.name} survives a second{' '}
            {moment.card.kind === 'number' ? moment.card.value : 'card'}
          </p>
        </div>
      )}
    </div>
  );
}
