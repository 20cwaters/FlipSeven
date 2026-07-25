import { useState } from 'react';

import type { GameState } from '@shared/game/types';

import { WordMark } from './BrandMark';

export interface LobbyProps {
  state: GameState;
  meId: string;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onStart: () => void;
  onLeave: () => void;
  onShowRules: () => void;
}

export function Lobby({
  state,
  meId,
  onAddBot,
  onRemovePlayer,
  onStart,
  onLeave,
  onShowRules,
}: LobbyProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isHost = state.hostId === meId;
  const full = state.players.length >= state.settings.maxPlayers;
  const shareLink = `${window.location.origin}/?room=${state.roomCode}`;

  const copy = async (value: string, what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <WordMark className="text-3xl" />
        <button type="button" className="btn-ghost !min-h-[40px] px-3 text-xs" onClick={onShowRules}>
          Rules
        </button>
      </header>

      <div className="deco-frame mb-4">
        <p className="text-center font-display text-xs uppercase tracking-widest text-marquee">
          Room Code
        </p>
        <button
          type="button"
          onClick={() => copy(state.roomCode, 'code')}
          className="mx-auto mt-1 block font-display text-6xl tracking-[0.2em] text-cream text-outline"
          aria-label={`Room code ${state.roomCode.split('').join(' ')}. Tap to copy.`}
        >
          {state.roomCode}
        </button>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-ghost !min-h-[40px] px-3 text-xs"
            onClick={() => copy(state.roomCode, 'code')}
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button
            type="button"
            className="btn-ghost !min-h-[40px] px-3 text-xs"
            onClick={() => copy(shareLink, 'link')}
          >
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <div className="panel mb-4 flex-1">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm uppercase tracking-widest text-marquee">
            Players
          </h2>
          <span className="text-xs text-cream/60">
            {state.players.length} / {state.settings.maxPlayers}
          </span>
        </div>

        <ul className="space-y-2">
          {state.players.map((player, index) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl border-2 border-ink/40 bg-teal-800/70 px-3 py-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-marquee font-display text-sm text-ink">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {player.name}
                {player.id === meId && <span className="ml-1 text-marquee">(you)</span>}
              </span>
              {player.id === state.hostId && (
                <span className="rounded-full border border-marquee/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marquee">
                  Host
                </span>
              )}
              {player.isBot && (
                <span className="rounded-full border border-frost/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-frost">
                  Bot
                </span>
              )}
              {isHost && player.id !== meId && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player.id)}
                  aria-label={`Remove ${player.name}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-tomato/60 text-tomato-light transition active:scale-95"
                >
                  ✕
                </button>
              )}
            </li>
          ))}

          {Array.from(
            { length: Math.max(0, state.settings.maxPlayers - state.players.length) },
            (_, i) => (
              <li
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-cream/25 px-3 py-2 text-cream/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-cream/25 text-xs">
                  {state.players.length + i + 1}
                </span>
                <span className="flex-1 text-sm italic">Empty seat</span>
                {isHost && (
                  <button
                    type="button"
                    className="rounded-lg border-2 border-frost/50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-frost"
                    onClick={onAddBot}
                  >
                    + Bot
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="panel mb-4 text-sm text-cream/75">
        <span className="font-display text-xs uppercase tracking-widest text-marquee">
          Playing to
        </span>{' '}
        {state.settings.targetScore} points
      </div>

      <div className="sticky bottom-0 space-y-2 pb-2">
        {isHost ? (
          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={onStart}
            disabled={state.players.length < 2}
          >
            {state.players.length < 2 ? 'Need 2+ players' : 'Start Game'}
          </button>
        ) : (
          <p className="rounded-xl border-2 border-ink/40 bg-teal-900/70 px-4 py-3 text-center text-sm">
            Waiting for the host to start…
          </p>
        )}
        <div className="flex gap-2">
          {isHost && !full && (
            <button type="button" className="btn-teal flex-1 text-sm" onClick={onAddBot}>
              Add Bot
            </button>
          )}
          <button type="button" className="btn-ghost flex-1 text-sm" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
