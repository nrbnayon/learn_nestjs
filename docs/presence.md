# Presence (Online / Offline) Guide

This document explains the presence design and client integration for real-time apps (one-to-one, group chats).

Key points:
- Real-time updates are delivered over WebSocket using the `/chat` namespace for messaging and `/presence` namespace for presence events.
- Presence state is stored in Redis keys `user:{userId}:online` with a TTL (120s). Clients send periodic heartbeats to refresh the TTL.
- Redis pub/sub channel `presence.events` is used to broadcast presence changes across instances.

Client example (connect + heartbeat):

```js
import { io } from 'socket.io-client';

// Connect to chat (messages)
const chatSocket = io('http://127.0.0.1:3001', {
  path: '/socket.io',
  auth: { token: 'BEARER_TOKEN' },
  transports: ['websocket'],
  namespace: '/chat',
});

// Connect to presence (presence updates + heartbeat)
const presenceSocket = io('http://127.0.0.1:3001/presence', {
  path: '/socket.io',
  auth: { token: 'BEARER_TOKEN' },
  transports: ['websocket'],
});

// Send heartbeat every 30s to keep TTL alive
setInterval(() => {
  presenceSocket.emit('presence:heartbeat');
}, 30000);

// Listen for online/offline events
presenceSocket.on('user:online', (data) => console.log('online', data));
presenceSocket.on('user:offline', (data) => console.log('offline', data));
presenceSocket.on('presence:update', (data) => console.log('presence update', data));
```

Notes:
- Use a single connection per namespace; avoid opening multiple namespaces unless necessary.
- For group and one-to-one chats, use rooms (e.g., `room:{roomId}`) on the `/chat` namespace for message delivery; presence per user is handled by `/presence`.
