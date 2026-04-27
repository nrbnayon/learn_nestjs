import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SocketStateService {
  private readonly logger = new Logger(SocketStateService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Map: userId → Set of socket IDs
   */
  private readonly userSockets = new Map<string, Set<string>>();

  /**
   * Map: socketId → userId
   */
  private readonly socketUser = new Map<string, string>();

  // ── Connection Management ─────────────────────────────────────────────────

  async addSocket(
    userId: string,
    socket: Socket,
  ): Promise<{ becameOnline: boolean }> {
    const socketsBefore = this.userSockets.get(userId)?.size ?? 0;
    const becameOnline = socketsBefore === 0;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    this.socketUser.set(socket.id, userId);

    if (becameOnline) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: true,
          lastSeenAt: null,
        },
      });
    }

    await this.redisService.set(`user:${userId}:online`, 'true', 120);

    if (becameOnline) {
      await this.redisService.publishJson('presence.events', {
        event: 'user_online',
        userId,
        socketId: socket.id,
        at: new Date().toISOString(),
      });
    }

    this.logger.debug(`Socket ${socket.id} added for user ${userId}`);
    return { becameOnline };
  }

  async removeSocket(
    socketId: string,
  ): Promise<{ userId?: string; becameOffline: boolean }> {
    const userId = this.socketUser.get(socketId);
    if (!userId) return { becameOffline: false };

    this.socketUser.delete(socketId);

    let becameOffline = false;
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        becameOffline = true;
        this.userSockets.delete(userId);

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            isOnline: false,
            lastSeenAt: new Date(),
          },
        });

        await this.redisService.del(`user:${userId}:online`);
        await this.redisService.publishJson('presence.events', {
          event: 'user_offline',
          userId,
          socketId,
          at: new Date().toISOString(),
        });
        this.logger.debug(
          `User ${userId} is now offline (last socket removed)`,
        );
      }
    }
    return { userId, becameOffline };
  }

  // ── Query Helpers ─────────────────────────────────────────────────────────

  isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!(sockets && sockets.size > 0);
  }

  getSocketIds(userId: string): string[] {
    return [...(this.userSockets.get(userId) ?? [])];
  }

  getUserId(socketId: string): string | undefined {
    return this.socketUser.get(socketId);
  }

  getOnlineUsers(): string[] {
    return [...this.userSockets.keys()];
  }

  getOnlineCount(): number {
    return this.userSockets.size;
  }

  getSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size ?? 0;
  }

  isSocket(socketId: string): boolean {
    return this.socketUser.has(socketId);
  }

  /**
   * Returns which of the given userIds are currently online.
   */
  filterOnlineUsers(userIds: string[]): string[] {
    return userIds.filter((id) => this.isOnline(id));
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  getStats(): { onlineUsers: number; totalSockets: number } {
    return {
      onlineUsers: this.userSockets.size,
      totalSockets: this.socketUser.size,
    };
  }
}
