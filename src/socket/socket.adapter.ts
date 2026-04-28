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

    // JWT authentication middleware
    server.use((socket: AuthenticatedSocket, next) => {
      void this.authenticateSocket(socket, next);
    });

    const socketState = this.app.get(SocketStateService, { strict: false });

    server.on('connection', (socket: AuthenticatedSocket) => {
      void this.handleSocketConnected(socketState, socket);
      socket.on('disconnect', () => {
        void this.handleSocketDisconnected(socketState, socket);
      });
    });

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

    const presenceUserId = String(userId);

    const { becameOnline } = await socketState.addSocket(
      presenceUserId,
      socket,
    );

    if (becameOnline) {
      const presenceNs = this.socketServer?.of('/presence');
      if (presenceNs) {
        presenceNs.emit(SOCKET_EVENTS.USER_ONLINE, {
          userId: presenceUserId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      } else {
        socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
          userId: presenceUserId,
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
      const presenceUserId = String(userId);
      const presenceNs = this.socketServer?.of('/presence');
      if (presenceNs) {
        presenceNs.emit(SOCKET_EVENTS.USER_OFFLINE, {
          userId: presenceUserId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      } else {
        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
          userId: presenceUserId,
          socketId: socket.id,
          at: new Date().toISOString(),
        });
      }
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
        handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token?.trim()) {
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
