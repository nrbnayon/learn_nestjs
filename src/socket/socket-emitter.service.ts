import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketEmitterService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToRoom(
    roomId: string,
    event: string,
    data: any,
    excludeSocketId?: string,
  ) {
    if (!this.server) return;

    // Access the /chat namespace at emit time — do NOT pre-create it
    // or the auth middleware will be skipped for that namespace.
    const chatNs = this.server.of('/chat');
    let emitter = chatNs.to(roomId);
    if (excludeSocketId) {
      emitter = emitter.except(excludeSocketId);
    }

    emitter.emit(event, data);
  }
}
