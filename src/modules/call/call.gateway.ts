import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { CallService } from './call.service';
import { CreateCallDto } from './dto/create-call.dto';

@WebSocketGateway({
  namespace: '/call',
  cors: { origin: true, credentials: true },
})
export class CallGateway {
  constructor(private readonly callService: CallService) {}

  @SubscribeMessage(SOCKET_EVENTS.AUTHENTICATE)
  handleCreateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateCallDto,
  ) {
    return this.callService.createSession(client.data.userId, dto);
  }

  @SubscribeMessage('call:signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Record<string, any>,
  ) {
    return this.callService.relaySignal(client.data.userId, payload);
  }
}
