// server.js (Backend - Node.js with WebSocket)
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = []; // Stores connected users
let waitingUsers = []; // Queue for pairing users

app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

wss.on('connection', (socket) => {
    users.push(socket);
    updateOnlineCount();
    
    socket.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'find') {
            findPartner(socket);
        } else if (data.type === 'message' && socket.partner) {
            socket.partner.send(JSON.stringify({ type: 'message', text: data.text }));
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
        const partner = waitingUsers.pop();
        socket.partner = partner;
        partner.partner = socket;
        socket.send(JSON.stringify({ type: 'connected' }));
        partner.send(JSON.stringify({ type: 'connected' }));
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
