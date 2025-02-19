const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = [];
let waitingUsers = [];
let userCount = 0; // Sequential User ID assignment

wss.on('connection', (socket) => {
    userCount++;
    socket.userId = userCount; // Assign unique ID
    socket.username = null; // Will be assigned by the user
    users.push(socket);
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
    });
});

function findPartner(socket) {
    if (waitingUsers.length > 0) {
        const partner = waitingUsers.pop();
        
        if (partner === socket) {
            // This should never happen, but just in case
            socket.send(JSON.stringify({ type: 'error', message: "Can't connect to yourself" }));
            return;
        }

        socket.partner = partner;
        partner.partner = socket;

        socket.send(JSON.stringify({ type: 'connected', partnerName: partner.username || `User ${partner.userId}` }));
        partner.send(JSON.stringify({ type: 'connected', partnerName: socket.username || `User ${socket.userId}` }));
    } else {
        socket.send(JSON.stringify({ type: 'noUser' }));
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
