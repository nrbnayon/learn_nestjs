import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class SocketStateService {
  private readonly logger = new Logger(SocketStateService.name);

  /**
   * Map: userId → Set of socket IDs
   */
  private readonly userSockets = new Map<string, Set<string>>();

  /**
   * Map: socketId → userId
   */
  private readonly socketUser = new Map<string, string>();

  // ── Connection Management ─────────────────────────────────────────────────

  addSocket(userId: string, socket: Socket): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);
    this.socketUser.set(socket.id, userId);
    this.logger.debug(`Socket ${socket.id} added for user ${userId}`);
  }

  removeSocket(socketId: string): string | undefined {
    const userId = this.socketUser.get(socketId);
    if (!userId) return undefined;

    this.socketUser.delete(socketId);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.logger.debug(`User ${userId} is now offline (last socket removed)`);
      }
    }
    return userId;
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
