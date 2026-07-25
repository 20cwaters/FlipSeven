import { useEffect, useMemo, useRef, useState } from 'react';

import { waitingOn } from '@shared/game/engine';
import type { GameState, LogLine } from '@shared/game/types';

import { ActionBar } from './ActionBar';
import { WordMark } from './BrandMark';
import { CardBack } from './PlayingCard';
import { Modal } from './Modal';
import { Moments } from './Moments';
import { PlayerPanel } from './PlayerPanel';

export interface GameTableProps {
  state: GameState;
  meId: string;
  onHit: () => void;
  onStay: () => void;
  onChooseTarget: (targetId: string) => void;
  onShowRules: () => void;
  onShowSummary: () => void;
  onLeave: () => void;
}

const LOG_TONE: Partial<Record<LogLine['kind'], string>> = {
  bust: 'text-tomato-light',
  flip7: 'text-marquee font-bold',
  freeze: 'text-frost',
  flip_three: 'text-grape',
  second_chance: 'text-emerald-300',
  stay: 'text-emerald-200',
  round: 'text-marquee',
  win: 'text-marquee font-bold',
};

export function GameTable({
  state,
  meId,
  onHit,
  onStay,
  onChooseTarget,
  onShowRules,
  onShowSummary,
  onLeave,
}: GameTableProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const waiting = useMemo(() => waitingOn(state), [state]);
  const me = state.players.find((p) => p.id === meId);
  const currentId =
    waiting?.type === 'decision' ? waiting.playerId : state.players[state.turnIndex]?.id;

  // The card that just landed, so its panel can animate it in.
  const flashCardId = state.flash?.card.id ?? null;
  const bustingId = state.flash?.busted ? state.flash.playerId : null;

  // Whoever must pick a target sees every eligible panel light up as a button.
  const targeting = state.pending?.actorId === meId ? state.pending : null;

  useEffect(() => {
    if (logOpen) logEnd.current?.scrollIntoView({ block: 'end' });
  }, [logOpen, state.log.length]);

  // Own panel first, then everyone else in seat order — the layout that reads
  // best on a phone, where your own tableau is what you touch.
  const ordered = useMemo(() => {
    const others = state.players.filter((p) => p.id !== meId);
    return me ? [me, ...others] : state.players;
  }, [state.players, me, meId]);

  const leader = Math.max(0, ...state.players.map((p) => p.totalScore));

  return (
    <div className="flex min-h-full flex-col">
      <Moments state={state} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b-2 border-ink/50 bg-teal-900/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <WordMark className="text-xl" />
          <span className="rounded-lg bg-black/25 px-2 py-1 font-display text-[11px] uppercase tracking-wide text-cream/80">
            Round {state.round}
          </span>
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 text-[11px] text-cream/70">
            <CardBack size="xs" className="!h-5 !w-4 !border !text-[6px]" />
            {state.deck.length}
          </span>
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            aria-label="Toggle game log"
            aria-expanded={logOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-cream/30 text-sm"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={onShowRules}
            aria-label="Rules"
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-cream/30 font-display text-sm"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            aria-label="Leave game"
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-tomato/50 text-sm text-tomato-light"
          >
            ⏻
          </button>
        </div>

        {/* Progress to the win threshold */}
        <div className="mx-auto mt-1.5 flex max-w-lg items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-marquee transition-[width] duration-700"
              style={{
                width: `${Math.min(100, (leader / state.settings.targetScore) * 100)}%`,
              }}
            />
          </div>
          <span className="font-display text-[10px] uppercase tracking-widest text-cream/60">
            {leader} / {state.settings.targetScore}
          </span>
        </div>
      </header>

      {/* Log drawer */}
      {logOpen && (
        <div className="border-b-2 border-ink/50 bg-teal-900/90 px-3 py-2">
          <div className="scrollbar-none mx-auto max-h-40 max-w-lg space-y-0.5 overflow-y-auto text-[12px] leading-snug">
            {state.log.length === 0 && (
              <p className="text-cream/40 italic">Nothing has happened yet.</p>
            )}
            {state.log.map((line) => (
              <p key={line.id} className={LOG_TONE[line.kind] ?? 'text-cream/70'}>
                {line.text}
              </p>
            ))}
            <div ref={logEnd} />
          </div>
        </div>
      )}

      {/* Table */}
      <main className="mx-auto w-full max-w-lg flex-1 space-y-2.5 px-3 py-3">
        {targeting && (
          <p className="rounded-xl border-2 border-frost bg-frost/20 px-3 py-2 text-center font-display text-xs uppercase tracking-widest text-cream">
            Tap a player to target
          </p>
        )}

        {ordered.map((player) => (
          <PlayerPanel
            key={player.id}
            player={player}
            state={state}
            isMe={player.id === meId}
            isCurrent={player.id === currentId && state.phase === 'playing'}
            isDealer={state.players[state.dealerIndex]?.id === player.id}
            flashCardId={state.flash?.playerId === player.id ? flashCardId : null}
            targetable={Boolean(targeting?.targets.includes(player.id))}
            onTarget={onChooseTarget}
            busting={bustingId === player.id}
          />
        ))}

        {state.phase === 'round_end' && (
          <button type="button" className="btn-ghost w-full text-sm" onClick={onShowSummary}>
            Show round scores
          </button>
        )}
      </main>

      <ActionBar state={state} me={me} waiting={waiting} onHit={onHit} onStay={onStay} />

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this game?"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1 text-sm"
              onClick={() => setLeaveOpen(false)}
            >
              Keep playing
            </button>
            <button type="button" className="btn-danger flex-1 text-sm" onClick={onLeave}>
              Leave
            </button>
          </div>
        }
      >
        <p className="text-sm text-cream/85">
          Your seat and score are given up, and the round carries on without you. You
          can't rejoin this game afterwards.
        </p>
      </Modal>
    </div>
  );
}
