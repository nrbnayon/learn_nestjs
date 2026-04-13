import { registerAs } from '@nestjs/config';

export default registerAs('socket', () => ({
  corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
  transports: ['websocket', 'polling'] as string[],
  pingInterval: 10000,
  pingTimeout: 5000,
}));
