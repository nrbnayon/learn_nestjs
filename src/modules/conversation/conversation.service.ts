/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

// ── Shared select fragment ────────────────────────────────────────────────────
const memberSelect = {
  id: true,
  isChatAdmin: true,
  isMuted: true,
  joinedAt: true,
  lastReadAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      avatar: true,
      isOnline: true,
      lastSeenAt: true,
    },
  },
};

const roomSelect = {
  id: true,
  name: true,
  description: true,
  avatar: true,
  type: true,
  isPrivate: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  members: { select: memberSelect },
  messages: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      content: true,
      type: true,
      createdAt: true,
      sender: {
        select: { id: true, fullName: true, username: true, avatar: true },
      },
      attachments: {
        take: 1,
        select: { url: true, mimeType: true, name: true },
      },
    },
  },
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create a room / conversation ──────────────────────────────────────────

  async createConversation(creatorId: string, dto: CreateConversationDto) {
    const type: RoomType =
      dto.type === 'GROUP' ? RoomType.GROUP : RoomType.DIRECT;

    // For DIRECT chats, enforce exactly 1 target participant
    if (type === RoomType.DIRECT) {
      if (dto.participantIds.length !== 1) {
        throw new BadRequestException(
          'Direct chats must have exactly 1 other participant',
        );
      }

      const otherId = dto.participantIds[0];

      // Return existing direct conversation if already exists
      const existing = await this.prisma.room.findFirst({
        where: {
          type: RoomType.DIRECT,
          members: { every: { userId: { in: [creatorId, otherId] } } },
        },
        include: { members: { select: memberSelect } },
      });

      if (existing) {
        this.logger.log(`Direct conversation already exists: ${existing.id}`);
        return existing;
      }
    }

    // Collect all unique member IDs (creator + participants)
    const allMemberIds = Array.from(
      new Set([creatorId, ...dto.participantIds]),
    );

    // Verify all participants exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: { id: true, fullName: true },
    });

    if (users.length !== allMemberIds.length) {
      throw new NotFoundException('One or more participants not found');
    }

    const roomName = dto.name ?? null;
    const roomDescription =
      (dto.description as unknown as string | null) ?? null;

    const room = await this.prisma.room.create({
      data: {
        name: roomName,
        description: roomDescription,
        type,
        isPrivate: dto.isPrivate ?? false,
        createdById: creatorId,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            isChatAdmin: userId === creatorId,
          })),
        },
      },
      select: roomSelect,
    });

    this.logger.log(
      `Room created: ${room.id} (${type}) by ${creatorId} with ${allMemberIds.length} members`,
    );
    return room;
  }

  // ── List all conversations for a user ────────────────────────────────────

  async listConversations(userId: string, search?: string) {
    const rooms = await this.prisma.room.findMany({
      where: {
        members: { some: { userId } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: roomSelect,
      orderBy: { updatedAt: 'desc' },
    });

    this.logger.debug(
      `Listed ${rooms.length} conversations for user ${userId}`,
    );
    return rooms;
  }

  // ── Get a single conversation ─────────────────────────────────────────────

  async getConversation(roomId: string, requesterId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: roomSelect,
    });

    if (!room) throw new NotFoundException('Conversation not found');

    const isMember = room.members.some((m) => m.user.id === requesterId);
    if (!isMember)
      throw new ForbiddenException('You are not a member of this conversation');

    return room;
  }

  // ── Add members to a group ────────────────────────────────────────────────

  async addMembers(roomId: string, requesterId: string, memberIds: string[]) {
    const room = await this.assertGroupAdmin(roomId, requesterId);

    // Filter out already-existing members
    const existingIds = room.members.map((m: any) => m.user.id);
    const newIds = memberIds.filter((id) => !existingIds.includes(id));

    if (!newIds.length)
      throw new BadRequestException('All specified users are already members');

    await this.prisma.roomMember.createMany({
      data: newIds.map((userId) => ({ roomId, userId })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Added ${newIds.length} members to room ${roomId} by ${requesterId}`,
    );
    return this.getConversation(roomId, requesterId);
  }

  // ── Remove a member from a group ─────────────────────────────────────────

  async removeMember(
    roomId: string,
    requesterId: string,
    targetUserId: string,
  ) {
    await this.assertGroupAdmin(roomId, requesterId);

    await this.prisma.roomMember.deleteMany({
      where: { roomId, userId: targetUserId },
    });

    this.logger.log(
      `Removed member ${targetUserId} from room ${roomId} by ${requesterId}`,
    );
  }

  // ── Leave a conversation ──────────────────────────────────────────────────

  async leaveConversation(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member)
      throw new NotFoundException('You are not a member of this conversation');

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    this.logger.log(`User ${userId} left room ${roomId}`);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });
    return Boolean(member);
  }

  private async assertGroupAdmin(roomId: string, requesterId: string) {
    const room = (await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    })) as any;

    if (!room) throw new NotFoundException('Conversation not found');
    if (room.type !== RoomType.GROUP)
      throw new BadRequestException('Only group chats support this action');

    const member = room.members.find((m: any) => m.user.id === requesterId);
    if (!member)
      throw new ForbiddenException('You are not a member of this conversation');
    if (!member.isChatAdmin)
      throw new ForbiddenException('Only group admins can perform this action');

    return room;
  }
}
