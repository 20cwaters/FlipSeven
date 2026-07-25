import { type FormEvent, useEffect, useState } from 'react';

import { BrandMark } from './BrandMark';

export interface JoinPageProps {
  onCreate: (opts: {
    name: string;
    botCount: number;
    maxPlayers: number;
    targetScore: number;
    tutorial: boolean;
  }) => void;
  onJoin: (opts: { code: string; name: string; tutorial: boolean }) => void;
  onShowRules: () => void;
  error: string | null;
  busy: boolean;
  /** Prefilled from a ?room= link or a previous session. */
  initialCode?: string;
  initialName?: string;
}

type Tab = 'join' | 'create';

/** Floating card confetti behind the panel — pure decoration. */
function BackgroundCards() {
  const pieces = [
    { left: '6%', top: '12%', delay: '0s', rotate: -14, color: '#F9BE3B', label: '7' },
    { left: '84%', top: '8%', delay: '1.2s', rotate: 12, color: '#E2452C', label: '12' },
    { left: '12%', top: '72%', delay: '2.1s', rotate: 8, color: '#5AB4E8', label: '4' },
    { left: '88%', top: '66%', delay: '0.6s', rotate: -9, color: '#3FA96B', label: '9' },
    { left: '48%', top: '3%', delay: '1.8s', rotate: 5, color: '#7C5CC4', label: '2' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.left + p.top}
          className="absolute animate-drift opacity-25"
          style={{ left: p.left, top: p.top, animationDelay: p.delay }}
        >
          <div
            className="flex h-16 w-11 items-center justify-center rounded-lg border-2 border-ink font-display text-2xl text-ink shadow-card-sm sm:h-24 sm:w-16 sm:text-4xl"
            style={{ backgroundColor: p.color, transform: `rotate(${p.rotate}deg)` }}
          >
            {p.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JoinPage({
  onCreate,
  onJoin,
  onShowRules,
  error,
  busy,
  initialCode = '',
  initialName = '',
}: JoinPageProps) {
  const [tab, setTab] = useState<Tab>(initialCode ? 'join' : 'create');
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [botCount, setBotCount] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [targetScore, setTargetScore] = useState(200);
  const [tutorial, setTutorial] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode.toUpperCase());
      setTab('join');
    }
  }, [initialCode]);

  // Bots can never outnumber the seats.
  useEffect(() => {
    setBotCount((n) => Math.min(n, maxPlayers - 1));
  }, [maxPlayers]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (tab === 'create') {
      onCreate({ name: trimmed, botCount, maxPlayers, targetScore, tutorial });
    } else {
      onJoin({ code: code.trim().toUpperCase(), name: trimmed, tutorial });
    }
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-8">
      <BackgroundCards />

      <div className="relative z-10 w-full max-w-md">
        <BrandMark className="mx-auto mb-4 h-40 w-full max-w-[300px] sm:h-48" />

        <div className="deco-frame">
          {/* Tabs */}
          <div
            className="mb-4 grid grid-cols-2 gap-2 rounded-xl border-2 border-ink/50 bg-teal-900/60 p-1"
            role="tablist"
            aria-label="Join or create a game"
          >
            {(['join', 'create'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-[44px] rounded-lg px-3 py-2 font-display text-sm uppercase tracking-wide transition ${
                  tab === t
                    ? 'bg-marquee text-ink shadow-card-sm'
                    : 'text-cream/70 hover:bg-white/10'
                }`}
              >
                {t === 'join' ? 'Join Game' : 'Create Game'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="player-name">
                Your Name
              </label>
              <input
                id="player-name"
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Casey"
                maxLength={16}
                autoComplete="nickname"
                required
              />
            </div>

            {tab === 'join' ? (
              <div>
                <label className="field-label" htmlFor="room-code">
                  Room Code
                </label>
                <input
                  id="room-code"
                  className="text-input text-center font-display text-3xl uppercase tracking-[0.4em]"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
                  }
                  placeholder="ABCD"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={4}
                  required
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="max-players">
                      Seats
                    </label>
                    <select
                      id="max-players"
                      className="text-input"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} players
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="bot-count">
                      Bots
                    </label>
                    <select
                      id="bot-count"
                      className="text-input"
                      value={botCount}
                      onChange={(e) => setBotCount(Number(e.target.value))}
                    >
                      {Array.from({ length: maxPlayers }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? 'None' : `${n} bot${n > 1 ? 's' : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="target-score">
                    Play to
                  </label>
                  <select
                    id="target-score"
                    className="text-input"
                    value={targetScore}
                    onChange={(e) => setTargetScore(Number(e.target.value))}
                  >
                    {[100, 150, 200, 300].map((n) => (
                      <option key={n} value={n}>
                        {n} points{n === 200 ? ' (standard)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-ink/40 bg-teal-900/50 p-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-marquee"
                checked={tutorial}
                onChange={(e) => setTutorial(e.target.checked)}
              />
              <span className="text-sm">
                <span className="block font-display text-xs uppercase tracking-widest text-marquee">
                  Tutorial mode
                </span>
                <span className="text-cream/80">
                  Guided prompts walk you through your first couple of rounds.
                </span>
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border-2 border-tomato bg-tomato/20 px-3 py-2 text-sm font-semibold text-cream"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Working…' : tab === 'join' ? 'Join Game' : 'Create Game'}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" className="btn-ghost text-xs" onClick={onShowRules}>
            How to play
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-cream/50">
          Flip 7 is a game by Eric Olsen, published by The Op. This is an unofficial
          fan-made web version for playing with friends.
        </p>
      </div>
    </div>
  );
}
