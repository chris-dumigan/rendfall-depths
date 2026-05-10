const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve all static files (html, css, js) from the current directory
app.use(express.static(path.join(__dirname, './')));

// When a player connects
// Keep track of all active players in memory
const activePlayers = {};

let hostId = null;

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Assign host if none exists
  if (!hostId) {
    hostId = socket.id;
    socket.emit('initSession', { isHost: true });
    console.log(`Player ${socket.id} assigned as HOST.`);
  } else {
    socket.emit('initSession', { isHost: false });
    console.log(`Player ${socket.id} assigned as CLIENT.`);
  }

  // Forward player actions/positions
  socket.on('playerUpdate', (data) => {
    socket.broadcast.emit('playerUpdate', { id: socket.id, ...data });
  });

  // Host broadcasts enemy state updates
  socket.on('hostEnemySync', (data) => {
    socket.broadcast.emit('clientEnemySync', data);
  });

  // Host broadcasts door open state
  socket.on('hostDoorSync', (data) => {
    socket.broadcast.emit('clientDoorSync', data);
  });

  // Forward client attack requests to the Host
  socket.on('clientRequestDamage', (data) => {
    socket.broadcast.emit('hostApplyClientDamage', {
      clientId: socket.id,
      ...data
    });
  });

  // Host confirms a kill and forwards the XP reward back to the specific Client
  socket.on('hostConfirmedKill', (data) => {
    io.to(data.clientId).emit('clientEarnXP', { xp: data.xp });
  });
  
  // Forward projectile spawn data from Client to Host
  socket.on('spawnProjectile', (data) => {
    console.log(`[SERVER Log] Received spawnProjectile from Client: ${socket.id} (${data.type}). Broadcasting to others...`);
    socket.broadcast.emit('spawnProjectile', data);
  });
  
  // Host tells client they took damage from an enemy projectile
  socket.on('playerForceDamage', (data) => {
    io.to(data.targetId).emit('applyForcedDamage', data);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (socket.id === hostId) {
      hostId = null; // Reset host so next connection can take over
    }
  });
});


// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


