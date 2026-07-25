import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import express from 'express';
import { Server } from 'socket.io';

import {
  type ClientToServerEvents,
  type CreateRoomPayload,
  type GameState,
  type JoinRoomPayload,
  type PlayerState,
  type RejoinPayload,
  type RoomAck,
  type ServerToClientEvents,
  chooseTarget,
  createPlayer,
  getPlayer,
  hit,
  nextRound,
  removePlayer,
  stay,
} from '../../shared/game/index.js';
import {
  type Room,
  addBot,
  beginGame,
  createRoom,
  deleteRoom,
  drive,
  getRoom,
  restartGame,
  roomCount,
} from './rooms.js';

const PORT = Number(process.env.PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** dist/ sits at server/dist, so the built client is two levels up. */
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const app = express();
app.use(compression());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: roomCount(), uptime: process.uptime() });
});

app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true, credentials: true },
});

/** Tracks which room/player each socket belongs to. */
interface SocketSession {
  roomCode: string;
  playerId: string;
}
const sessions = new Map<string, SocketSession>();

function broadcaster(code: string) {
  return (state: GameState) => io.to(code).emit('state', state);
}

function sanitizeName(raw: string, fallback: string): string {
  const name = String(raw ?? '').trim().slice(0, 16);
  return name.length > 0 ? name : fallback;
}

function attach(socket: { id: string; join: (r: string) => void }, room: Room, playerId: string) {
  socket.join(room.code);
  room.sockets.set(playerId, socket.id);
  sessions.set(socket.id, { roomCode: room.code, playerId });
}

/** Resolves the room + player for an incoming event, or null if the socket is stale. */
function contextFor(socketId: string): { room: Room; player: PlayerState } | null {
  const session = sessions.get(socketId);
  if (!session) return null;
  const room = getRoom(session.roomCode);
  if (!room) return null;
  const player = getPlayer(room.state, session.playerId);
  if (!player) return null;
  return { room, player };
}

io.on('connection', (socket) => {
  socket.on('create_room', (payload: CreateRoomPayload, cb: (a: RoomAck) => void) => {
    const maxPlayers = Math.min(8, Math.max(2, Number(payload?.maxPlayers) || 4));
    const targetScore = Math.min(500, Math.max(50, Number(payload?.targetScore) || 200));
    const hostId = `p-${socket.id}`;

    const room = createRoom(hostId, () => {}, { maxPlayers, targetScore });
    room.broadcast = broadcaster(room.code);
    room.state.hostId = hostId;
    room.state.players.push(
      createPlayer(hostId, sanitizeName(payload?.name, 'Host')),
    );

    const bots = Math.min(
      Math.max(0, Number(payload?.botCount) || 0),
      maxPlayers - 1,
    );
    for (let i = 0; i < bots; i++) addBot(room);

    attach(socket, room, hostId);
    cb?.({ ok: true, roomCode: room.code, playerId: hostId });
    drive(room);
  });

  socket.on('join_room', (payload: JoinRoomPayload, cb: (a: RoomAck) => void) => {
    const room = getRoom(String(payload?.code ?? ''));
    if (!room) return cb?.({ ok: false, error: 'No game found with that code.' });
    if (room.state.phase !== 'lobby') {
      return cb?.({ ok: false, error: 'That game has already started.' });
    }
    if (room.state.players.length >= room.state.settings.maxPlayers) {
      return cb?.({ ok: false, error: 'That game is full.' });
    }

    const playerId = `p-${socket.id}`;
    const used = new Set(room.state.players.map((p) => p.name.toLowerCase()));
    let name = sanitizeName(payload?.name, `Player ${room.state.players.length + 1}`);
    if (used.has(name.toLowerCase())) name = `${name} 2`;

    room.state.players.push(createPlayer(playerId, name));
    room.state.version += 1;
    attach(socket, room, playerId);
    cb?.({ ok: true, roomCode: room.code, playerId });
    drive(room);
  });

  socket.on('rejoin', (payload: RejoinPayload, cb: (a: RoomAck) => void) => {
    const room = getRoom(String(payload?.code ?? ''));
    if (!room) return cb?.({ ok: false, error: 'That game is no longer running.' });
    const player = getPlayer(room.state, String(payload?.playerId ?? ''));
    if (!player) return cb?.({ ok: false, error: 'You are not seated in that game.' });

    player.connected = true;
    room.state.version += 1;
    attach(socket, room, player.id);
    cb?.({ ok: true, roomCode: room.code, playerId: player.id });
    drive(room);
  });

  socket.on('add_bot', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const { room } = ctx;
    if (room.state.hostId !== ctx.player.id) return;
    if (room.state.phase !== 'lobby') return;
    if (!addBot(room)) {
      socket.emit('error_message', 'The table is full.');
      return;
    }
    drive(room);
  });

  socket.on('remove_player', ({ playerId }: { playerId: string }) => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const { room } = ctx;
    if (room.state.hostId !== ctx.player.id) return;
    if (room.state.phase !== 'lobby') return;
    if (playerId === room.state.hostId) return;

    const target = getPlayer(room.state, playerId);
    if (!removePlayer(room.state, playerId).ok) return;

    const socketId = room.sockets.get(playerId);
    if (socketId && target && !target.isBot) {
      io.to(socketId).emit('kicked', 'The host removed you from the game.');
      sessions.delete(socketId);
    }
    room.sockets.delete(playerId);
    drive(room);
  });

  socket.on('start_game', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const { room } = ctx;
    if (room.state.hostId !== ctx.player.id) return;
    if (room.state.phase !== 'lobby') return;
    if (room.state.players.length < 2) {
      socket.emit('error_message', 'You need at least 2 players — add a bot to play solo.');
      return;
    }
    beginGame(room);
  });

  socket.on('hit', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const result = hit(ctx.room.state, ctx.player.id);
    if (!result.ok) return socket.emit('error_message', result.error ?? 'Illegal move.');
    drive(ctx.room);
  });

  socket.on('stay', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const result = stay(ctx.room.state, ctx.player.id);
    if (!result.ok) return socket.emit('error_message', result.error ?? 'Illegal move.');
    drive(ctx.room);
  });

  socket.on('choose_target', ({ targetId }: { targetId: string }) => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const result = chooseTarget(ctx.room.state, ctx.player.id, String(targetId));
    if (!result.ok) return socket.emit('error_message', result.error ?? 'Illegal target.');
    drive(ctx.room);
  });

  socket.on('next_round', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    if (ctx.room.state.phase !== 'round_end') return;
    nextRound(ctx.room.state);
    drive(ctx.room);
  });

  socket.on('play_again', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    if (ctx.room.state.hostId !== ctx.player.id) return;
    restartGame(ctx.room);
  });

  // Leaving is allowed at any point, mid-round included — the engine repairs the
  // round around the empty seat rather than ending it for everyone else.
  socket.on('leave_room', () => {
    const ctx = contextFor(socket.id);
    if (!ctx) return;
    const { room, player } = ctx;

    removePlayer(room.state, player.id);
    room.sockets.delete(player.id);
    sessions.delete(socket.id);
    socket.leave(room.code);

    // Nobody left to play for — don't keep a bot-only table running.
    if (!room.state.players.some((p) => !p.isBot)) {
      deleteRoom(room.code);
      return;
    }
    drive(room);
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    sessions.delete(socket.id);
    if (!session) return;
    const room = getRoom(session.roomCode);
    if (!room) return;
    const player = getPlayer(room.state, session.playerId);
    if (!player) return;

    // Only drop the seat if the room hasn't started; mid-game we keep the seat
    // so they can rejoin, and the drive loop auto-plays for them meanwhile.
    if (room.state.phase === 'lobby') {
      removePlayer(room.state, player.id);
      room.sockets.delete(player.id);
      if (!room.state.players.some((p) => !p.isBot)) {
        deleteRoom(room.code);
        return;
      }
    } else {
      player.connected = false;
      room.sockets.delete(player.id);
      room.state.version += 1;
    }
    drive(room);
  });
});

// SPA fallback — every non-asset route serves the client shell.
app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run `npm run build`.');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Flip 7 server listening on :${PORT}`);
});
