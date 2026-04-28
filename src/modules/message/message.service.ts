import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import {
  MulterFile,
  StorageService,
  UploadedFile,
} from '../../shared/storage.service';
// import { MessageStatus } from '@prisma/client';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
    files: MulterFile[] = [],
  ) {
    // Verify user is member of room
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: dto.roomId, userId: senderId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const uploadedFiles = await this.uploadMessageFiles(files);
    const attachments = this.buildAttachments(
      dto.attachments ?? [],
      uploadedFiles,
    );
    const content = dto.content?.trim() || null;

    if (!content && !attachments.length) {
      throw new BadRequestException(
        'Message content or attachments are required',
      );
    }

    const type = this.resolveMessageType(dto.type, attachments);

    try {
      const message = await this.prisma.message.create({
        data: {
          content,
          type,
          roomId: dto.roomId,
          senderId,
          replyToId: dto.replyToId,
          attachments: attachments.length
            ? {
                create: attachments.map((attachment) => ({
                  url: attachment.url,
                  name: attachment.name,
                  mimeType: attachment.mimeType,
                  size: attachment.size,
                  width: attachment.width,
                  height: attachment.height,
                  duration: attachment.duration,
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
    } catch (error) {
      await this.cleanupAttachments(attachments);
      throw error;
    }
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
      include: { attachments: true },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId)
      throw new ForbiddenException('Cannot delete others message');

    await this.prisma.$transaction([
      this.prisma.messageAttachment.deleteMany({
        where: { messageId },
      }),
      this.prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: null, // Clear content for privacy
        },
      }),
    ]);

    await this.cleanupAttachments(message.attachments);

    this.logger.log(`Message ${messageId} deleted by ${userId}`);
  }

  private async uploadMessageFiles(
    files: MulterFile[],
  ): Promise<UploadedFile[]> {
    if (!files.length) return [];

    const uploadedFiles: UploadedFile[] = [];
    for (const file of files) {
      uploadedFiles.push(await this.storageService.uploadFile(file));
    }

    return uploadedFiles;
  }

  private buildAttachments(
    dtoAttachments: NonNullable<SendMessageDto['attachments']>,
    uploadedFiles: UploadedFile[],
  ): Array<
    NonNullable<SendMessageDto['attachments']>[number] & {
      key: string;
    }
  > {
    return [
      ...dtoAttachments.map((attachment) => ({
        ...attachment,
        key: this.resolveUploadKey(attachment.key ?? attachment.url),
      })),
      ...uploadedFiles.map((file) => ({
        key: file.key,
        url: file.url,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        width: undefined,
        height: undefined,
        duration: undefined,
      })),
    ];
  }

  private resolveMessageType(
    requestedType: MessageType | undefined,
    attachments: Array<{ mimeType: string }>,
  ): MessageType {
    if (!attachments.length) {
      return requestedType ?? MessageType.TEXT;
    }

    const attachmentTypes = attachments.map((attachment) =>
      this.resolveMediaType(attachment.mimeType),
    );
    const uniqueTypes = Array.from(new Set(attachmentTypes));

    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }

    return MessageType.FILE;
  }

  private resolveMediaType(mimeType: string): MessageType {
    if (mimeType.startsWith('image/')) return MessageType.IMAGE;
    if (mimeType.startsWith('video/')) return MessageType.VIDEO;
    if (mimeType.startsWith('audio/')) return MessageType.AUDIO;
    return MessageType.FILE;
  }

  private async cleanupAttachments(
    attachments: Array<{ key?: string; url: string }>,
  ): Promise<void> {
    await this.storageService.deleteFiles(
      attachments.map((attachment) =>
        this.resolveUploadKey(attachment.key ?? attachment.url),
      ),
    );
  }

  private resolveUploadKey(value: string): string {
    return value
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+/, '')
      .replace(/^uploads\//i, '')
      .replace(/^uploads\\/i, '')
      .replace(/\\/g, '/');
  }
}
