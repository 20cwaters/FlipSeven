import { useEffect, useMemo, useState } from 'react';

import { FLIP_SEVEN_BONUS, FLIP_SEVEN_COUNT } from '@shared/game/cards';
import type { GameState, PlayerState, WaitingOn } from '@shared/game/types';

interface Tip {
  id: string;
  title: string;
  body: string;
  /** Shown only while this holds true. */
  when: (ctx: TipContext) => boolean;
}

interface TipContext {
  state: GameState;
  me: PlayerState;
  waiting: WaitingOn;
  myTurn: boolean;
}

/**
 * Tips fire in order and each is shown once. They're deliberately tied to what
 * is actually on screen, so a tip never explains something the player can't see.
 */
const TIPS: Tip[] = [
  {
    id: 'deal',
    title: 'The opening deal',
    body: 'The dealer gives everyone one card face-up. Nothing is hidden in Flip 7 — you can always see every tableau on the table.',
    when: ({ state }) => state.phase === 'dealing' && state.round === 1,
  },
  {
    id: 'first-turn',
    title: 'Hit or Stay?',
    body: 'Hit flips another card and adds it to your row. Stay banks everything in front of you and sits you out for the rest of the round. Your bust risk is shown right above the buttons.',
    when: ({ myTurn }) => myTurn,
  },
  {
    id: 'duplicates',
    title: 'Duplicates bust you',
    body: 'Flip a number you already have and your round ends at zero. Big numbers are worth more but there are far more of them in the deck — twelve 12s, only one 1.',
    when: ({ me, myTurn }) => myTurn && me.numbers.length >= 2,
  },
  {
    id: 'modifier',
    title: 'You picked up a modifier',
    body: `Modifiers sit safely in your row — they can never bust you. A ×2 doubles your number cards, and +N cards are added after that. They don't count toward Flip ${FLIP_SEVEN_COUNT}.`,
    when: ({ me }) => me.modifiers.length > 0,
  },
  {
    id: 'second-chance',
    title: 'Second Chance is a shield',
    body: 'Keep it face-up. The next duplicate you flip gets discarded along with the shield instead of busting you — so you can afford to push a little harder.',
    when: ({ me }) => Boolean(me.secondChance),
  },
  {
    id: 'targeting',
    title: 'An action card needs a target',
    body: 'Freeze makes someone bank immediately. Flip Three forces them to draw three cards in a row. You can aim either one at yourself if that helps you.',
    when: ({ state, me }) => state.pending?.actorId === me.id,
  },
  {
    id: 'flip-seven',
    title: `Chasing Flip ${FLIP_SEVEN_COUNT}`,
    body: `Collect ${FLIP_SEVEN_COUNT} unique numbers and the round ends instantly for everyone — you get +${FLIP_SEVEN_BONUS} on top, and anyone still in banks whatever they're holding.`,
    when: ({ state }) => state.players.some((p) => p.numbers.length >= 4),
  },
  {
    id: 'round-end',
    title: 'Scoring the round',
    body: `Add your number cards, double them if you hold a ×2, then add flat bonuses and any Flip ${FLIP_SEVEN_COUNT} bonus. Busted players score nothing. The dealer moves one seat and you go again.`,
    when: ({ state }) => state.phase === 'round_end',
  },
];

export interface TutorialProps {
  enabled: boolean;
  state: GameState;
  me: PlayerState | undefined;
  waiting: WaitingOn;
  onFinish: () => void;
}

export function Tutorial({ enabled, state, me, waiting, onFinish }: TutorialProps) {
  const [seen, setSeen] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const myTurn = waiting?.type === 'decision' && waiting.playerId === me?.id;

  const active = useMemo(() => {
    if (!enabled || !me) return null;
    const ctx: TipContext = { state, me, waiting, myTurn };
    return TIPS.find((tip) => !seen.includes(tip.id) && tip.when(ctx)) ?? null;
  }, [enabled, me, state, waiting, myTurn, seen]);

  // Tutorial mode covers the opening rounds, then gets out of the way.
  useEffect(() => {
    if (enabled && state.round > 2) onFinish();
  }, [enabled, state.round, onFinish]);

  if (!active || dismissed === active.id) return null;

  const dismiss = () => {
    setDismissed(active.id);
    setSeen((prev) => [...prev, active.id]);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[104px]">
      <div className="pointer-events-auto mx-auto max-w-lg animate-pop-in rounded-2xl border-2 border-marquee bg-teal-900/97 p-3 shadow-card">
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-marquee font-display text-sm text-ink"
            aria-hidden="true"
          >
            ?
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs uppercase tracking-widest text-marquee">
              {active.title}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-cream/90">{active.body}</p>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-cream/60"
            onClick={onFinish}
          >
            Turn off tips
          </button>
          <button
            type="button"
            className="rounded-lg border-2 border-marquee bg-marquee px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink"
            onClick={dismiss}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
