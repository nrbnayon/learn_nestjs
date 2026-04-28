import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
// import { MessageStatus } from '@prisma/client';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(senderId: string, dto: SendMessageDto) {
    // Verify user is member of room
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: dto.roomId, userId: senderId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        type: dto.type || 'TEXT',
        roomId: dto.roomId,
        senderId,
        replyToId: dto.replyToId,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((a) => ({
                url: a.url,
                name: a.name,
                mimeType: a.mimeType,
                size: a.size,
                width: a.width,
                height: a.height,
                duration: a.duration,
              })),
            }
          : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
        attachments: true,
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // Update room's updatedAt timestamp
    await this.prisma.room.update({
      where: { id: dto.roomId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `Message ${message.id} sent by ${senderId} in room ${dto.roomId}`,
    );
    return message;
  }

  async listMessages(
    roomId: string,
    userId: string,
    limit = 50,
    cursor?: string,
  ) {
    // Verify membership
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const messages = await this.prisma.message.findMany({
      where: { roomId, isDeleted: false },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        replyTo: true,
      },
    });

    return messages.reverse(); // Return in chronological order
  }

  async markRead(userId: string, dto: ReadMessageDto) {
    const receipt = await this.prisma.readReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: dto.messageId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        messageId: dto.messageId,
        userId,
      },
    });

    // Also update room member's lastReadAt
    const message = await this.prisma.message.findUnique({
      where: { id: dto.messageId },
      select: { roomId: true },
    });

    if (message) {
      await this.prisma.roomMember.update({
        where: { roomId_userId: { roomId: message.roomId, userId } },
        data: { lastReadAt: new Date() },
      });
    }

    return receipt;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId)
      throw new ForbiddenException('Cannot delete others message');

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: null, // Clear content for privacy
      },
    });

    this.logger.log(`Message ${messageId} deleted by ${userId}`);
  }
}
