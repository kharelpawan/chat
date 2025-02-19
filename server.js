const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = [];
let waitingUsers = [];
let userCount = 0; // For assigning sequential IDs

wss.on('connection', (socket) => {
    userCount++;
    socket.userId = userCount; // Assign sequential user ID
    users.push(socket);
    updateOnlineCount();

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'start') {
            findPartner(socket);
        } else if (data.type === 'message' && socket.partner) {
            socket.partner.send(JSON.stringify({ type: 'message', text: data.text, sender: `User ${socket.userId}` }));
        } else if (data.type === 'skip') {
            disconnect(socket, true);
            findPartner(socket);
        } else if (data.type === 'stop') {
            disconnect(socket, false);
        }
    });

    socket.on('close', () => {
        disconnect(socket);
    });
});

function findPartner(socket) {
    if (waitingUsers.length > 0) {
        // Get a random user from waiting list
        const randomIndex = Math.floor(Math.random() * waitingUsers.length);
        const partner = waitingUsers.splice(randomIndex, 1)[0];

        socket.partner = partner;
        partner.partner = socket;

        const connectMsg1 = JSON.stringify({ type: 'connected', userId: partner.userId });
        const connectMsg2 = JSON.stringify({ type: 'connected', userId: socket.userId });

        socket.send(connectMsg1);
        partner.send(connectMsg2);
    } else {
        waitingUsers.push(socket);
    }
}

function disconnect(socket, isSkip = false) {
    users = users.filter(u => u !== socket);
    waitingUsers = waitingUsers.filter(u => u !== socket);

    if (socket.partner) {
        socket.partner.send(JSON.stringify({ type: 'disconnected' }));
        if (!isSkip) findPartner(socket.partner);
        socket.partner.partner = null;
    }

    socket.partner = null;
    updateOnlineCount();
}

function updateOnlineCount() {
    users.forEach(user => {
        user.send(JSON.stringify({ type: 'online', count: users.length }));
    });
}

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
