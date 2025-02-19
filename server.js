const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = []; // List of connected users
let waitingUsers = []; // Queue for pairing

// Function to generate a random username
function generateUsername() {
    const adjectives = ["Fast", "Happy", "Mysterious", "Clever", "Brave"];
    const nouns = ["Tiger", "Eagle", "Ninja", "Panda", "Wizard"];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

wss.on('connection', (socket) => {
    socket.username = generateUsername();
    users.push(socket);
    updateOnlineCount();

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'start') {
            findPartner(socket);
        } else if (data.type === 'message' && socket.partner) {
            socket.partner.send(JSON.stringify({ type: 'message', text: data.text, sender: socket.username }));
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

        const connectMsg = JSON.stringify({ type: 'connected', username: partner.username });
        const partnerMsg = JSON.stringify({ type: 'connected', username: socket.username });

        socket.send(connectMsg);
        partner.send(partnerMsg);
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
