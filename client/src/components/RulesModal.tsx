import type { ReactNode } from 'react';

import {
  ACTION_CARD_COUNTS,
  ACTION_DESCRIPTIONS,
  ACTION_LABELS,
  EXPECTED_DECK_SIZE,
  FLIP_SEVEN_BONUS,
  FLIP_SEVEN_COUNT,
  NUMBER_CARD_COUNTS,
  PLUS_MODIFIER_COUNTS,
  X2_MODIFIER_COUNT,
} from '@shared/game/cards';
import type { ActionKind } from '@shared/game/types';

import { Modal } from './Modal';
import { PlayingCard } from './PlayingCard';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-marquee">
        {title}
      </h3>
      <div className="space-y-2 text-sm leading-relaxed text-cream/85">{children}</div>
    </section>
  );
}

export function RulesModal({
  open,
  onClose,
  targetScore = 200,
}: {
  open: boolean;
  onClose: () => void;
  targetScore?: number;
}) {
  const numberTotal = Object.values(NUMBER_CARD_COUNTS).reduce((a, b) => a + b, 0);
  const actionTotal = Object.values(ACTION_CARD_COUNTS).reduce((a, b) => a + b, 0);
  const plusTotal = Object.values(PLUS_MODIFIER_COUNTS).reduce((a, b) => a + b, 0);

  return (
    <Modal open={open} onClose={onClose} title="How to play Flip 7">
      <Section title="Goal">
        <p>
          Be the first to <strong>{targetScore} points</strong>. The winner is
          checked at the end of each round, so a round always plays out in full.
        </p>
      </Section>

      <Section title="Your turn">
        <p>
          Everyone gets one card face-up to start the round. Then, in turn order, you
          choose:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-marquee">Hit</strong> — flip another card. Draw a
            number you already have and you <strong className="text-tomato-light">bust</strong>:
            zero for the round, and you're out until the next one.
          </li>
          <li>
            <strong className="text-emerald-300">Stay</strong> — bank the points in
            front of you and sit out the rest of the round.
          </li>
        </ul>
      </Section>

      <Section title={`Flip ${FLIP_SEVEN_COUNT}!`}>
        <p>
          Collect <strong>{FLIP_SEVEN_COUNT} unique number cards</strong> without busting
          and the round ends instantly for everyone. Every player still in banks what
          they have, and you take a{' '}
          <strong className="text-marquee">+{FLIP_SEVEN_BONUS} bonus</strong> on top.
        </p>
      </Section>

      <Section title="Action cards">
        <p className="text-cream/70">
          Resolved the moment they're flipped. Freeze and Flip Three are aimed at any
          player still in the round — including yourself.
        </p>
        <div className="mt-2 space-y-3">
          {(Object.keys(ACTION_LABELS) as ActionKind[]).map((action) => (
            <div key={action} className="flex gap-3">
              <PlayingCard card={{ id: `rules-${action}`, kind: 'action', action }} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs uppercase tracking-wide text-cream">
                  {ACTION_LABELS[action]}
                  <span className="ml-2 font-body text-[10px] font-normal normal-case tracking-normal text-cream/50">
                    ×{ACTION_CARD_COUNTS[action]} in deck
                  </span>
                </p>
                <p className="text-xs text-cream/80">{ACTION_DESCRIPTIONS[action]}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-cream/60">
          You can only hold one Second Chance at a time. Draw a second and you must pass
          it to another player who has none — if nobody qualifies, it's discarded.
        </p>
      </Section>

      <Section title="Modifier cards">
        <div className="flex items-start gap-3">
          <PlayingCard card={{ id: 'rules-x2', kind: 'modifier', modifier: 'x2' }} size="sm" />
          <PlayingCard
            card={{ id: 'rules-plus', kind: 'modifier', modifier: 'plus', value: 8 }}
            size="sm"
          />
          <p className="flex-1 text-xs">
            Modifiers just sit in your tableau. They never bust you and they don't count
            toward Flip {FLIP_SEVEN_COUNT}.
          </p>
        </div>
      </Section>

      <Section title="Scoring a round">
        <ol className="ml-4 list-decimal space-y-1">
          <li>Add up your number cards.</li>
          <li>
            Double that total if you hold an <strong>×2</strong> card.
          </li>
          <li>Add each flat bonus (+2, +4, +6, +8, +10).</li>
          <li>
            Add <strong>+{FLIP_SEVEN_BONUS}</strong> if you completed a Flip{' '}
            {FLIP_SEVEN_COUNT}.
          </li>
        </ol>
        <p className="rounded-lg border-2 border-ink/40 bg-black/25 p-2 text-xs">
          Example: 3 + 9 + 12 = 24, doubled by ×2 → 48, plus a +4 card → <strong>52</strong>.
        </p>
        <p>Busted players score 0 for the round — modifiers and all.</p>
      </Section>

      <Section title="The deck">
        <p>
          {EXPECTED_DECK_SIZE} cards: {numberTotal} number cards, {actionTotal} action
          cards, and {plusTotal + X2_MODIFIER_COUNT} modifiers.
        </p>
        <p className="text-xs text-cream/70">
          Each number appears as many times as its face value — there are twelve 12s but
          only one 0 and one 1. High cards are worth more <em>and</em> far likelier to
          bust you. That's the whole game.
        </p>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
          {Object.entries(NUMBER_CARD_COUNTS).map(([value, count]) => (
            <div key={value} className="text-center">
              <PlayingCard
                card={{ id: `rules-n${value}`, kind: 'number', value: Number(value) }}
                size="xs"
                className="mx-auto"
              />
              <span className="mt-0.5 block text-[9px] text-cream/50">×{count}</span>
            </div>
          ))}
        </div>
      </Section>
    </Modal>
  );
}
