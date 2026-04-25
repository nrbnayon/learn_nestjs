/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

interface SocketDataWithUserId {
  userId?: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient() as unknown as {
      id: string;
      data: SocketDataWithUserId;
    };
    const userId = client.data.userId;

    // The SocketIoAdapter middleware has already authenticated the socket.
    // We just verify the userId is set on socket.data.
    if (!userId) {
      this.logger.warn(`WS guard rejected socket ${client.id}: no userId`);
      throw new WsException('Unauthorized');
    }

    return true;
  }
}
