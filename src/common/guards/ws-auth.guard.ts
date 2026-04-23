import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    // The SocketIoAdapter middleware has already authenticated the socket.
    // We just verify the userId is set on socket.data.
    const userId = client.data?.userId;

    if (!userId) {
      this.logger.warn(`WS guard rejected socket ${client.id}: no userId`);
      throw new WsException('Unauthorized');
    }

    return true;
  }
}
