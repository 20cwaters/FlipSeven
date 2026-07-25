import { type Socket, io } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@shared/game/protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * In dev, Vite proxies /socket.io to the game server on :3001.
 * In production the client is served by that same server, so a same-origin
 * connection is all we need.
 */
export const socket: GameSocket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 600,
});

/** Session details persisted so a refresh or dropped connection can rejoin. */
const STORAGE_KEY = 'flip7.session';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  name: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private browsing — session persistence is a nicety, not a requirement */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
