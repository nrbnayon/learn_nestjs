import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import type { MulterFile } from '../../shared/storage.service';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('room/:roomId')
  @ApiOperation({ summary: 'List messages in a room' })
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.messageService.listMessages(
      roomId,
      userId,
      limit ? +limit : 50,
      cursor,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Send a message (via HTTP)' })
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Message sent')
  @UseInterceptors(FilesInterceptor('files', 10))
  sendMessage(
    @CurrentUser('id')
    userId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: unknown[] = [],
  ) {
    return this.messageService.sendMessage(userId, dto, files as MulterFile[]);
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark a message as read' })
  @ResponseMessage('Message marked as read')
  markRead(
    @CurrentUser('id')
    userId: string,
    @Body() dto: ReadMessageDto,
  ) {
    return this.messageService.markRead(userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a message' })
  @ResponseMessage('Message deleted')
  deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messageService.deleteMessage(userId, messageId);
  }
}
