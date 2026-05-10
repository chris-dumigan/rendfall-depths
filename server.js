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

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // 1. Tell the newly connected player about everyone else already in the game
    socket.emit('currentPlayers', activePlayers);

    // 2. Broadcast the newly joined player's default state to everyone else
    socket.on('joinGame', (playerData) => {
        activePlayers[socket.id] = {
            id: socket.id,
            x: playerData.x,
            y: playerData.y,
            direction: playerData.direction,
            className: playerData.className,
            state: playerData.state,
            hp: playerData.hp,
            maxHp: playerData.maxHp,
            dying: playerData.dying,
            activeAbility: playerData.activeAbility
        };
        // Tell everyone a new player has arrived
        socket.broadcast.emit('newPlayer', activePlayers[socket.id]);
    });

    // 3. Relay movement updates
    socket.on('playerMovement', (movementData) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = movementData.x;
            activePlayers[socket.id].y = movementData.y;
            activePlayers[socket.id].direction = movementData.direction;
            activePlayers[socket.id].state = movementData.state;
            activePlayers[socket.id].moving = movementData.moving;

            // Send to everyone EXCEPT the sender
            socket.broadcast.emit('playerMoved', activePlayers[socket.id]);
        }
    });

    // 4. Relay action events (like attacks or spell casts)
    socket.on('playerAction', (actionData) => {
        socket.broadcast.emit('playerActed', {
            id: socket.id,
            action: actionData.action, // e.g. 'slash', 'fireball', 'whirlwind'
            direction: actionData.direction
        });
    });

    // 5. Clean up when someone leaves
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete activePlayers[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});


// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


