const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = new Map();  // Stores all users by ID
let waitingUsers = [];  // Queue of users waiting for a chat
let userCount = 0;  // Assigns unique user IDs

wss.on('connection', (socket) => {
    userCount++;
    const userId = userCount;
    socket.userId = userId;
    socket.username = null;
    socket.partner = null;

    users.set(userId, socket);
    updateOnlineCount();

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'setName') {
            socket.username = data.username;
        } else if (data.type === 'start') {
            findPartner(socket);
        } else if (data.type === 'message' && socket.partner) {
            socket.partner.send(JSON.stringify({
                type: 'message',
                text: data.text,
                sender: socket.username || `User ${socket.userId}`
            }));
        } else if (data.type === 'skip') {
            disconnect(socket, true);
            findPartner(socket);
        } else if (data.type === 'stop') {
            disconnect(socket, false);
        }
    });

    socket.on('close', () => {
        disconnect(socket);
        users.delete(userId);
        updateOnlineCount();
    });
});

function findPartner(socket) {
    // Ensure the user isn't already paired
    if (socket.partner) return;

    for (let i = 0; i < waitingUsers.length; i++) {
        const partner = waitingUsers[i];

        if (partner !== socket) {
            waitingUsers.splice(i, 1); // Remove matched user from queue
            socket.partner = partner;
            partner.partner = socket;

            socket.send(JSON.stringify({ type: 'connected', partnerName: partner.username || `User ${partner.userId}` }));
            partner.send(JSON.stringify({ type: 'connected', partnerName: socket.username || `User ${socket.userId}` }));

            return;
        }
    }

    // No partner found, add to waiting list
    waitingUsers.push(socket);
    socket.send(JSON.stringify({ type: 'noUser' }));
}

function disconnect(socket, isSkip = false) {
    waitingUsers = waitingUsers.filter(u => u !== socket);

    if (socket.partner) {
        socket.partner.send(JSON.stringify({ type: 'disconnected' }));

        if (!isSkip) {
            findPartner(socket.partner);
        }
        
        socket.partner.partner = null;
        socket.partner = null;
    }
}

function updateOnlineCount() {
    const count = users.size;
    users.forEach(user => {
        user.send(JSON.stringify({ type: 'online', count }));
    });
}

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
