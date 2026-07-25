/** Socket.IO event contract shared by the client and server. */

import type { GameState } from './types.js';

export interface CreateRoomPayload {
  name: string;
  botCount: number;
  maxPlayers: number;
  targetScore: number;
  tutorial: boolean;
}

export interface JoinRoomPayload {
  code: string;
  name: string;
  tutorial: boolean;
}

export interface RejoinPayload {
  code: string;
  playerId: string;
}

export interface RoomAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
}

export interface ClientToServerEvents {
  create_room: (p: CreateRoomPayload, cb: (ack: RoomAck) => void) => void;
  join_room: (p: JoinRoomPayload, cb: (ack: RoomAck) => void) => void;
  rejoin: (p: RejoinPayload, cb: (ack: RoomAck) => void) => void;
  add_bot: () => void;
  remove_player: (p: { playerId: string }) => void;
  start_game: () => void;
  hit: () => void;
  stay: () => void;
  choose_target: (p: { targetId: string }) => void;
  next_round: () => void;
  play_again: () => void;
  leave_room: () => void;
}

export interface ServerToClientEvents {
  state: (state: GameState) => void;
  error_message: (message: string) => void;
  kicked: (reason: string) => void;
}

export const ROOM_CODE_LENGTH = 4;
