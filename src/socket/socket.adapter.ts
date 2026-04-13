import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SocketStateService } from './socket-state.service';

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
    server.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token missing'));
        }

        const jwtService = this.app.get(JwtService);
        const payload = jwtService.verify(token, {
          secret: this.configService.get<string>('jwt.secret'),
        });

        if (!payload?.sub) {
          return next(new Error('Invalid token payload'));
        }

        socket.data.userId = payload.sub;
        socket.data.email = payload.email;
        socket.data.role = payload.role;

        this.logger.debug(`Socket authenticated: userId=${payload.sub}`);
        next();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Socket authentication failed: ${message}`);
        next(new Error('Unauthorized'));
      }
    });

    return server;
  }
}
