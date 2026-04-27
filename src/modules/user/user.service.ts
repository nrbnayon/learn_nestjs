import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketStateService } from '../../socket/socket-state.service';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  username: true,
  avatar: true,
  bio: true,
  role: true,
  status: true,
  tenantId: true,
  isOnline: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketState: SocketStateService,
  ) {}

  async listUsers(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('No update data provided');
    }

    if (dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          username: dto.username,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new BadRequestException('Username already taken');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.displayName,
        username: dto.username,
        avatar: dto.avatar,
        bio: dto.bio,
      },
      select: userSelect,
    });
  }

  async setPresence(userId: string, isOnline: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: isOnline ? undefined : new Date(),
      },
    });
  }

  async listFriendsPresence(userId: string, search?: string, limit?: string) {
    const friendIds = await this.getAcceptedFriendIds(userId);
    if (!friendIds.length) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: friendIds },
        ...(search
          ? {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: userSelect,
      take: this.parseLimit(limit),
      orderBy: { fullName: 'asc' },
    });

    return users.map((user) => this.mapPresence(user));
  }

  async listActiveUsers(params: {
    requesterId: string;
    requesterRole?: string;
    requesterTenantId?: string | null;
    search?: string;
    limit?: string;
  }) {
    const isAdmin = this.isAdminRole(params.requesterRole);

    if (!isAdmin) {
      const friends = await this.listFriendsPresence(
        params.requesterId,
        params.search,
        params.limit,
      );
      return friends.filter((friend) => friend.isOnline);
    }

    const where: {
      tenantId?: string;
      isOnline: true;
      OR?: Array<{
        username?: { contains: string; mode: 'insensitive' };
        fullName?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      isOnline: true,
    };

    const isSuperAdmin =
      (params.requesterRole ?? '').toUpperCase() === 'SUPER_ADMIN';
    if (!isSuperAdmin && params.requesterTenantId) {
      where.tenantId = params.requesterTenantId;
    }

    if (params.search) {
      where.OR = [
        {
          username: { contains: params.search, mode: 'insensitive' },
        },
        {
          fullName: { contains: params.search, mode: 'insensitive' },
        },
        {
          email: { contains: params.search, mode: 'insensitive' },
        },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: userSelect,
      take: this.parseLimit(params.limit),
      orderBy: { fullName: 'asc' },
    });

    return users.map((user) => this.mapPresence(user));
  }

  async canViewPresence(
    requesterId: string,
    targetUserId: string,
    requesterRole?: string,
  ): Promise<boolean> {
    if (requesterId === targetUserId) {
      return true;
    }

    if (this.isAdminRole(requesterRole)) {
      return true;
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: requesterId },
        ],
      },
      select: { id: true },
    });

    return Boolean(friendship);
  }

  async getPresenceByUserId(
    targetUserId: string,
    requesterId: string,
    requesterRole?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canView = await this.canViewPresence(
      requesterId,
      targetUserId,
      requesterRole,
    );

    if (!canView) {
      throw new ForbiddenException('You can only view your friends presence');
    }

    return this.mapPresence(user);
  }

  private async getAcceptedFriendIds(userId: string): Promise<string[]> {
    const relations = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requesterId: true,
        addresseeId: true,
      },
    });

    return relations.map((relation) =>
      relation.requesterId === userId
        ? relation.addresseeId
        : relation.requesterId,
    );
  }

  private mapPresence(user: {
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    avatar: string | null;
    isOnline: boolean;
    lastSeenAt: Date | null;
  }) {
    const isOnline = this.socketState.isOnline(user.id) || user.isOnline;
    const lastSeenAt = isOnline ? null : user.lastSeenAt;

    return {
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline,
      lastSeenAt,
      lastSeenText: this.formatLastSeen(lastSeenAt),
    };
  }

  private formatLastSeen(lastSeenAt: Date | null): string {
    if (!lastSeenAt) {
      return 'online';
    }

    const diffMs = Date.now() - lastSeenAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes <= 0) {
      return 'just now';
    }

    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    return lastSeenAt.toISOString();
  }

  private parseLimit(limit?: string): number {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 100;
    }

    return Math.min(Math.floor(parsed), 200);
  }

  private isAdminRole(role?: string): boolean {
    const normalized = (role ?? '').toUpperCase();
    return normalized === 'ADMIN' || normalized === 'SUPER_ADMIN';
  }
}
