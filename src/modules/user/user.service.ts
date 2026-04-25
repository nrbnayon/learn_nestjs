import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
}
