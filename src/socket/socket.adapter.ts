/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DefaultEventsMap, Server, ServerOptions, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SocketStateService } from './socket-state.service';
import { SOCKET_EVENTS } from '../common/constants/events.constant';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

type SocketData = {
  userId?: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
};

type SocketHandshake = {
  auth?: { token?: string };
  headers?: { authorization?: string };
};

type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);
  private socketServer: Server | null = null;

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

    const server = super.createIOServer(port, serverOptions) as Server;
    this.socketServer = server;

    const socketState = this.app.get(SocketStateService, { strict: false });

    // Helper to attach logic to a namespace
    const setupNamespace = (namespace: {
      use: (
        fn: (socket: AuthenticatedSocket, next: (err?: Error) => void) => void,
      ) => void;
      on: (event: string, fn: (socket: AuthenticatedSocket) => void) => void;
    }) => {
      namespace.use(
        (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
          void this.authenticateSocket(socket, next);
        },
      );

      namespace.on('connection', (socket: AuthenticatedSocket) => {
        void this.handleSocketConnected(socketState, socket);

        socket.on('disconnect', () => {
          void this.handleSocketDisconnected(socketState, socket);
        });
      });
    };

    // Apply to Root namespace
    setupNamespace(server);

    // Apply to all other dynamic namespaces (like /chat, /presence)
    setupNamespace(server.of(/.*/));

    return server;
  }

  private async handleSocketConnected(
    socketState: SocketStateService,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(
          `Socket ${socket.id} connected but userId is missing in data`,
        );
        return;
      }

      const presenceUserId = String(userId);
      const { becameOnline } = await socketState.addSocket(
        presenceUserId,
        socket,
      );

      if (becameOnline) {
        this.logger.log(`User ${presenceUserId} is now online`);
        const presenceNs = this.socketServer?.of('/presence');
        if (presenceNs) {
          presenceNs.emit(SOCKET_EVENTS.USER_ONLINE, {
            userId: presenceUserId,
            socketId: socket.id,
            at: new Date().toISOString(),
          });
        }
      }
      this.logger.log(
        `Socket ${socket.id} connected for user ${presenceUserId}`,
      );
      const stats = socketState.getStats();
      this.logger.log(
        `Current State: ${stats.onlineUsers} users online across ${stats.totalSockets} sockets`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling socket connection: ${message}`);
    }
  }

  private async handleSocketDisconnected(
    socketState: SocketStateService,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const { userId, becameOffline } = await socketState.removeSocket(
        socket.id,
      );

      if (userId && becameOffline) {
        const presenceUserId = String(userId);
        this.logger.log(`User ${presenceUserId} is now offline`);
        const presenceNs = this.socketServer?.of('/presence');
        if (presenceNs) {
          presenceNs.emit(SOCKET_EVENTS.USER_OFFLINE, {
            userId: presenceUserId,
            socketId: socket.id,
            at: new Date().toISOString(),
          });
        }
      }
      this.logger.log(`Socket ${socket.id} disconnected`);
      const stats = socketState.getStats();
      this.logger.log(
        `Current State: ${stats.onlineUsers} users online across ${stats.totalSockets} sockets`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling socket disconnection: ${message}`);
    }
  }

  private async authenticateSocket(
    socket: AuthenticatedSocket,
    next: (err?: Error) => void,
  ) {
    try {
      const handshake = socket.handshake as SocketHandshake;
      const token =
        handshake.auth?.token ??
        handshake.headers?.authorization?.replace('Bearer ', '') ??
        (handshake.headers as Record<string, any>)?.token;

      if (!token || typeof token !== 'string' || !token.trim()) {
        this.logger.warn(
          `Authentication failed: Token missing for socket ${socket.id}`,
        );
        return next(new Error('Authentication token missing'));
      }

      const accessToken = token.trim();

      const jwtService = this.app.get(JwtService);
      const redisService = this.app.get(RedisService);
      const payload = jwtService.verify<{
        sub: string;
        tenantId?: string;
        roles?: string[];
        permissions?: string[];
      }>(accessToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const hash = crypto
        .createHash('sha256')
        .update(accessToken)
        .digest('hex');
      const isBlacklisted = await redisService.exists(
        `blacklist:access:${hash}`,
      );
      if (isBlacklisted) {
        this.logger.warn(
          `Authentication failed: Token blacklisted for user ${payload.sub}`,
        );
        return next(new Error('Token has been revoked'));
      }

      if (!payload?.sub) {
        this.logger.warn(`Authentication failed: No sub in payload`);
        return next(new Error('Invalid token payload'));
      }

      socket.data.userId = payload.sub;
      socket.data.tenantId = payload.tenantId;
      socket.data.roles = payload.roles ?? [];
      socket.data.permissions = payload.permissions ?? [];

      this.logger.log(`Socket authenticated: userId=${payload.sub}`);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Socket authentication failed: ${message}`);
      next(new Error('Unauthorized'));
    }
  }
}
