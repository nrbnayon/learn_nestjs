import { Injectable } from '@nestjs/common';
import { CreateCallDto } from './dto/create-call.dto';

@Injectable()
export class CallService {
  createSession(userId: string, dto: CreateCallDto) {
    return {
      sessionId: `call_${Date.now()}`,
      userId,
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }

  relaySignal(userId: string, payload: Record<string, any>) {
    return {
      userId,
      payload,
      relayedAt: new Date().toISOString(),
    };
  }
}
