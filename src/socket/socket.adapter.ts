/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SocketStateService } from './socket-state.service';
import { SOCKET_EVENTS } from '../common/constants/events.constant';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

type SocketWithAuthData = {
  handshake: {
    auth?: { token?: string | undefined };
    headers?: { authorization?: string | undefined };
  };
  data: {
    userId?: string;
    tenantId?: string;
    roles?: string[];
    permissions?: string[];
  };
};

type AuthenticatedSocket = import('socket.io').Socket & SocketWithAuthData;

export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(
    private readonly app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const corsOrigin = this.configService.get<string>(
      'socket.corsOrigin',
      'http://localhost:5173',
    );

    const serverOptions: ServerOptions = {
      ...options,
      cors: {
        origin: corsOrigin.split(',').map((o) => o.trim()),
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingInterval: 10000,
      pingTimeout: 5000,
      allowEIO3: true,
    };

    const server: Server = super.createIOServer(port, serverOptions);

    // JWT authentication middleware
    server.use((socket: SocketWithAuthData, next) => {
      void this.authenticateSocket(socket, next);
    });

    const socketState = this.app.get(SocketStateService, { strict: false });

    server.on(
      'connection',
      (socket: AuthenticatedSocket) => {
        void this.handleSocketConnected(socketState, socket);
        socket.on('disconnect', () => {
          void this.handleSocketDisconnected(socketState, socket);
        });
      },
    );

    return server;
  }

  private async handleSocketConnected(
    socketState: SocketStateService,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) {
      return;
    }

    const { becameOnline } = await socketState.addSocket(
      userId,
      socket,
    );
    
    if (becameOnline) {
      // Emit presence event to presence namespace so clients subscribed to /presence
      // receive user online notifications. Falls back to global broadcast when
      // the namespace is not present.
      try {
        const presenceNs = socket.server.of('/presence');
        presenceNs.emit(SOCKET_EVENTS.USER_ONLINE, {
          userId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      } catch (err) {
        socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
          userId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      }
    }
  }

  private async handleSocketDisconnected(
    socketState: SocketStateService,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const { userId, becameOffline } = await socketState.removeSocket(socket.id);

    if (userId && becameOffline) {
      try {
        const presenceNs = socket.server.of('/presence');
        presenceNs.emit(SOCKET_EVENTS.USER_OFFLINE, {
          userId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      } catch (err) {
        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
          userId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      }
    }
  }

  private async authenticateSocket(
    socket: SocketWithAuthData,
    next: (err?: Error) => void,
  ) {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const jwtService = this.app.get(JwtService);
      const redisService = this.app.get(RedisService);
      const payload = jwtService.verify<{
        sub: string;
        tenantId?: string;
        roles?: string[];
        permissions?: string[];
      }>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const isBlacklisted = await redisService.exists(
        `blacklist:access:${hash}`,
      );
      if (isBlacklisted) {
        return next(new Error('Token has been revoked'));
      }

      if (!payload?.sub) {
        return next(new Error('Invalid token payload'));
      }

      socket.data.userId = payload.sub;
      socket.data.tenantId = payload.tenantId;
      socket.data.roles = payload.roles ?? [];
      socket.data.permissions = payload.permissions ?? [];

      this.logger.debug(`Socket authenticated: userId=${payload.sub}`);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Socket authentication failed: ${message}`);
      next(new Error('Unauthorized'));
    }
  }
}
