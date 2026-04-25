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

type CallSocket = Socket;

@WebSocketGateway({
  namespace: '/call',
  cors: { origin: true, credentials: true },
})
export class CallGateway {
  constructor(private readonly callService: CallService) {}

  @SubscribeMessage(SOCKET_EVENTS.AUTHENTICATE)
  handleCreateCall(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() dto: CreateCallDto,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    return this.callService.createSession(socketData.data?.userId ?? '', dto);
  }

  @SubscribeMessage('call:signal')
  handleSignal(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() payload: Record<string, unknown>,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    return this.callService.relaySignal(socketData.data?.userId ?? '', payload);
  }
}
