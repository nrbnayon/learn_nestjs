import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MessageService } from './message.service';
import { ReadMessageDto } from './dto/read-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get(':roomId')
  listMessages(@Param('roomId') roomId: string) {
    return this.messageService.listMessages(roomId);
  }

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto) {
    return this.messageService.sendMessage(dto);
  }

  @Post('read')
  markRead(@Body() dto: ReadMessageDto) {
    return this.messageService.markRead(dto);
  }
}