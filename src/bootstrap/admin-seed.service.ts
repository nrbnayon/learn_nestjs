import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.configService.get<string>(
      'app.nodeEnv',
      'development',
    );
    if (nodeEnv === 'production') {
      return;
    }

    const adminName = this.configService.get<string>('seed.adminName')?.trim();
    const adminEmail = this.configService
      .get<string>('seed.adminEmail')
      ?.trim()
      .toLowerCase();
    const adminPassword = this.configService.get<string>('seed.adminPassword');

    if (!adminName || !adminEmail || !adminPassword) {
      this.logger.debug(
        'Admin seed skipped: ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD not fully configured',
      );
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: adminEmail }, { username: this.toUsername(adminName) }],
      },
      select: { id: true, email: true, username: true },
    });

    if (existing) {
      this.logger.log(
        `Admin seed skipped: user already exists (${existing.email ?? existing.username})`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    await this.prisma.user.create({
      data: {
        fullName: adminName,
        email: adminEmail,
        username: await this.findAvailableUsername(this.toUsername(adminName)),
        password: passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    });

    this.logger.log(`Admin seed created: ${adminEmail}`);
  }

  private async findAvailableUsername(baseUsername: string): Promise<string> {
    let candidate = baseUsername;
    let index = 0;

    while (index < 20) {
      const exists = await this.prisma.user.findFirst({
        where: { username: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }

      index += 1;
      candidate = `${baseUsername}${1000 + index}`;
    }

    return `${baseUsername}${Date.now().toString().slice(-6)}`;
  }

  private toUsername(fullName: string): string {
    const normalized = fullName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || 'admin_user';
  }
}
