import {
  OnModuleInit,
  Logger,
  UseGuards,
  Injectable,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { SocketStateService } from '../../socket/socket-state.service';
import { RedisSubscriber } from '../../redis/redis.subscriber';
import { RedisService } from '../../redis/redis.service';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';

@WebSocketGateway({ namespace: '/presence', cors: { origin: true, credentials: true } })
@Injectable()
export class PresenceGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketState: SocketStateService,
    private readonly redisSubscriber: RedisSubscriber,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Subscribe to Redis presence events so this instance can re-emit them
    await this.redisSubscriber.subscribe('presence.events', (channel, message) => {
      try {
        const data = JSON.parse(message);
        if (data.event === 'user_online') {
          this.server.emit(SOCKET_EVENTS.USER_ONLINE, data);
        } else if (data.event === 'user_offline') {
          this.server.emit(SOCKET_EVENTS.USER_OFFLINE, data);
        } else {
          this.server.emit(SOCKET_EVENTS.PRESENCE_UPDATE, data);
        }
      } catch (err) {
        this.logger.warn('Invalid presence event message');
      }
    });
  }

  async handleConnection(client: Socket) {
    // authenticated by adapter; reflect current state
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    // join a room for user so other clients can target this user's presence
    await client.join(`user:${userId}`);
    this.logger.debug(`Socket ${client.id} connected to /presence for user ${userId}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    this.logger.debug(`Socket ${client.id} disconnected from /presence for user ${userId}`);
  }

  /** Client heartbeat to keep presence TTL alive. */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('presence:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket, @MessageBody() _payload: any) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    // refresh TTL on Redis key
    await this.redisService.expire(`user:${userId}:online`, 120).catch(() => {});
    // emit presence update for UI consumers if needed
    this.server.to(`user:${userId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, at: new Date().toISOString() });
  }
}
