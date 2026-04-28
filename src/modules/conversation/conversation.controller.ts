import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('conversations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a direct or group conversation' })
  @ResponseMessage('Conversation created successfully')
  createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationService.createConversation(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all conversations for the current user' })
  listConversations(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
  ) {
    return this.conversationService.listConversations(userId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single conversation by ID' })
  getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') roomId: string,
  ) {
    return this.conversationService.getConversation(roomId, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add members to a group conversation (admin only)' })
  @ResponseMessage('Members added successfully')
  addMembers(
    @CurrentUser('id') userId: string,
    @Param('id') roomId: string,
    @Body() body: { memberIds: string[] },
  ) {
    return this.conversationService.addMembers(roomId, userId, body.memberIds);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from a group (admin only)' })
  @ResponseMessage('Member removed successfully')
  removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') roomId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.conversationService.removeMember(roomId, userId, memberId);
  }

  @Delete(':id/leave')
  @ApiOperation({ summary: 'Leave a conversation' })
  @ResponseMessage('Left conversation successfully')
  leaveConversation(
    @CurrentUser('id') userId: string,
    @Param('id') roomId: string,
  ) {
    return this.conversationService.leaveConversation(roomId, userId);
  }
}
