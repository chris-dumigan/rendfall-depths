const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, './')));

const rooms = new Map();

function roomFor(id) {
  const roomId = String(id || 'rendfall').trim().slice(0, 32) || 'rendfall';
  if (!rooms.has(roomId)) rooms.set(roomId, { hostId: null, players: {}, gameMode: null, pvpRules: null, ready: {} });
  return { roomId, room: rooms.get(roomId) };
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (!room.hostId && Object.keys(room.players).length === 0) rooms.delete(roomId);
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('joinGame', (data = {}) => {
    const { roomId, room } = roomFor(data.roomId);
    if (!room.hostId && data.multiplayerIntent === 'join') {
      socket.emit('joinError', { message: `No hosted game found for room "${roomId}". Host the game first, then join.` });
      cleanupRoom(roomId);
      return;
    }

    socket.data.roomId = roomId;
    socket.join(roomId);

    const isHost = !room.hostId;
    if (isHost) {
      room.hostId = socket.id;
      room.gameMode = data.gameMode || room.gameMode;
      if (data.pvpRules) room.pvpRules = data.pvpRules;
    }

    room.players[socket.id] = { id: socket.id, ...data, roomId: undefined };

    socket.emit('initSession', { isHost, roomId, hostId: room.hostId, gameMode: room.gameMode, pvpRules: room.pvpRules });
    socket.emit('currentPlayers', room.players);
    socket.to(roomId).emit('newPlayer', room.players[socket.id]);
    io.to(roomId).emit('roomRoster', {
      roomId,
      hostId: room.hostId,
      players: Object.keys(room.players)
    });

    console.log(`Player ${socket.id} joined room ${roomId} as ${isHost ? 'HOST' : 'CLIENT'}.`);
  });

  socket.on('hostPvpRules', (data = {}) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    room.gameMode = 'pvp';
    room.pvpRules = data.pvpRules || room.pvpRules;
    socket.to(roomId).emit('pvpRulesSync', { pvpRules: room.pvpRules });
  });

  socket.on('pvpReady', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.ready[socket.id] = true;
    const playerIds = Object.keys(room.players);
    io.to(roomId).emit('pvpReadySync', { ready: Object.keys(room.ready), players: playerIds });
    if (playerIds.length >= 2 && playerIds.every(id => room.ready[id])) {
      room.ready = {};
      io.to(roomId).emit('pvpStartCountdown', { frames: 180 });
    }
  });

  socket.on('playerUpdate', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players[socket.id] = { ...(room.players[socket.id] || {}), id: socket.id, ...data };
    socket.to(roomId).emit('playerUpdate', { id: socket.id, ...data });
  });

  socket.on('playerAction', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('playerAction', { playerId: socket.id, ...data });
  });

  socket.on('hostEnemySync', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    socket.to(roomId).emit('clientEnemySync', data);
  });

  socket.on('hostDoorSync', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    socket.to(roomId).emit('clientDoorSync', data);
  });

  socket.on('hostHazardSync', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    socket.to(roomId).emit('clientHazardSync', data);
  });

  socket.on('hostStageSync', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    socket.to(roomId).emit('clientStageSync', data);
  });

  socket.on('clientRequestDamage', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room?.hostId) return;
    io.to(room.hostId).emit('hostApplyClientDamage', { clientId: socket.id, ...data });
  });

  socket.on('hostConfirmedKill', (data) => {
    io.to(data.clientId).emit('clientEarnXP', { xp: data.xp });
  });

  socket.on('spawnProjectile', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('spawnProjectile', data);
  });

  socket.on('playerForceDamage', (data) => {
    io.to(data.targetId).emit('applyForcedDamage', data);
  });

  socket.on('playerStatusSync', (data) => {
    io.to(data.targetId).emit('applyForcedStatus', data);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    console.log(`Player disconnected: ${socket.id}`);
    if (!room) return;

    delete room.players[socket.id];
    delete room.ready[socket.id];
    socket.to(roomId).emit('playerDisconnected', socket.id);

    if (socket.id === room.hostId) {
      room.hostId = Object.keys(room.players)[0] || null;
      if (room.hostId) {
        io.to(room.hostId).emit('initSession', { isHost: true, roomId, hostId: room.hostId, gameMode: room.gameMode, pvpRules: room.pvpRules });
        io.to(roomId).emit('hostChanged', { hostId: room.hostId });
      } else {
        io.to(roomId).emit('hostChanged', { hostId: null });
      }
    }

    io.to(roomId).emit('roomRoster', {
      roomId,
      hostId: room.hostId,
      players: Object.keys(room.players)
    });
    cleanupRoom(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
