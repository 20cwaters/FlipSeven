import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { waitingOn } from '@shared/game/engine';
import type { GameState } from '@shared/game/types';

import { GameOver } from './components/GameOver';
import { GameTable } from './components/GameTable';
import { JoinPage } from './components/JoinPage';
import { Lobby } from './components/Lobby';
import { RoundSummary } from './components/RoundSummary';
import { RulesModal } from './components/RulesModal';
import { TargetPrompt } from './components/TargetPrompt';
import { Tutorial } from './components/Tutorial';
import { clearSession, loadSession, saveSession, socket } from './socket';

function roomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') ?? '').toUpperCase();
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  const stored = useRef(loadSession());
  const lastRoundShown = useRef(0);

  // Derived here (not just in GameTable) because the tutorial needs it too.
  const waiting = useMemo(() => (state ? waitingOn(state) : null), [state]);

  // ---- socket wiring ------------------------------------------------------
  useEffect(() => {
    const onState = (next: GameState) => setState(next);
    const onError = (message: string) => {
      setError(message);
      window.setTimeout(() => setError((e) => (e === message ? null : e)), 4000);
    };
    const onKicked = (reason: string) => {
      clearSession();
      stored.current = null;
      setState(null);
      setMeId(null);
      setError(reason);
    };
    const onConnect = () => {
      setConnected(true);
      // Reclaim our seat after a refresh or a dropped connection.
      const session = stored.current;
      if (session) {
        socket.emit('rejoin', { code: session.roomCode, playerId: session.playerId }, (ack) => {
          if (ack.ok && ack.playerId) {
            setMeId(ack.playerId);
          } else {
            clearSession();
            stored.current = null;
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on('state', onState);
    socket.on('error_message', onError);
    socket.on('kicked', onKicked);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off('state', onState);
      socket.off('error_message', onError);
      socket.off('kicked', onKicked);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Pop the scorecard automatically once per round.
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'round_end' && lastRoundShown.current !== state.round) {
      lastRoundShown.current = state.round;
      setSummaryOpen(true);
    }
    if (state.phase !== 'round_end') setSummaryOpen(false);
  }, [state]);

  // ---- actions ------------------------------------------------------------
  const enterRoom = useCallback(
    (roomCode: string, playerId: string, name: string, wantsTutorial: boolean) => {
      setMeId(playerId);
      setTutorial(wantsTutorial);
      const session = { roomCode, playerId, name };
      stored.current = session;
      saveSession(session);
      // Drop ?room= so a refresh doesn't try to re-join a game we're already in.
      window.history.replaceState({}, '', window.location.pathname);
    },
    [],
  );

  const handleCreate = useCallback(
    (opts: {
      name: string;
      botCount: number;
      maxPlayers: number;
      targetScore: number;
      tutorial: boolean;
    }) => {
      setBusy(true);
      setError(null);
      socket.emit('create_room', opts, (ack) => {
        setBusy(false);
        if (!ack.ok || !ack.roomCode || !ack.playerId) {
          setError(ack.error ?? 'Could not create the game.');
          return;
        }
        enterRoom(ack.roomCode, ack.playerId, opts.name, opts.tutorial);
      });
    },
    [enterRoom],
  );

  const handleJoin = useCallback(
    (opts: { code: string; name: string; tutorial: boolean }) => {
      setBusy(true);
      setError(null);
      socket.emit('join_room', opts, (ack) => {
        setBusy(false);
        if (!ack.ok || !ack.roomCode || !ack.playerId) {
          setError(ack.error ?? 'Could not join that game.');
          return;
        }
        enterRoom(ack.roomCode, ack.playerId, opts.name, opts.tutorial);
      });
    },
    [enterRoom],
  );

  const handleLeave = useCallback(() => {
    socket.emit('leave_room');
    clearSession();
    stored.current = null;
    setState(null);
    setMeId(null);
    lastRoundShown.current = 0;
  }, []);

  // ---- render -------------------------------------------------------------
  const inRoom = state && meId && state.players.some((p) => p.id === meId);

  if (!inRoom) {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <JoinPage
          onCreate={handleCreate}
          onJoin={handleJoin}
          onShowRules={() => setRulesOpen(true)}
          error={error}
          busy={busy || !connected}
          initialCode={roomFromUrl()}
          initialName={stored.current?.name ?? ''}
        />
        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </>
    );
  }

  const me = state.players.find((p) => p.id === meId);

  return (
    <>
      <ConnectionBanner connected={connected} />

      {state.phase === 'lobby' ? (
        <Lobby
          state={state}
          meId={meId}
          onAddBot={() => socket.emit('add_bot')}
          onRemovePlayer={(playerId) => socket.emit('remove_player', { playerId })}
          onStart={() => socket.emit('start_game')}
          onLeave={handleLeave}
          onShowRules={() => setRulesOpen(true)}
        />
      ) : (
        <GameTable
          state={state}
          meId={meId}
          onHit={() => socket.emit('hit')}
          onStay={() => socket.emit('stay')}
          onChooseTarget={(targetId) => socket.emit('choose_target', { targetId })}
          onShowRules={() => setRulesOpen(true)}
          onShowSummary={() => setSummaryOpen(true)}
        />
      )}

      {state.pending && state.phase !== 'game_over' && (
        <TargetPrompt
          state={state}
          meId={meId}
          onChoose={(targetId) => socket.emit('choose_target', { targetId })}
        />
      )}

      <Tutorial
        enabled={tutorial && state.phase !== 'lobby' && state.phase !== 'game_over'}
        state={state}
        me={me}
        waiting={waiting}
        onFinish={() => setTutorial(false)}
      />

      <RoundSummary
        state={state}
        meId={meId}
        open={summaryOpen && state.phase === 'round_end'}
        onNextRound={() => {
          socket.emit('next_round');
          setSummaryOpen(false);
        }}
        onClose={() => setSummaryOpen(false)}
      />

      {state.phase === 'game_over' && (
        <GameOver
          state={state}
          meId={meId}
          onPlayAgain={() => socket.emit('play_again')}
          onLeave={handleLeave}
        />
      )}

      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        targetScore={state.settings.targetScore}
      />

      {error && (
        <div
          role="alert"
          className="fixed inset-x-0 top-2 z-[70] mx-auto w-[92%] max-w-sm animate-pop-in rounded-xl border-2 border-tomato bg-tomato px-3 py-2 text-center text-sm font-semibold text-cream shadow-card"
        >
          {error}
        </div>
      )}
    </>
  );
}

function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[80] bg-tomato px-3 py-1 text-center text-xs font-bold uppercase tracking-widest text-cream">
      Reconnecting…
    </div>
  );
}
