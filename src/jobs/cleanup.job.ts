import { Injectable } from '@nestjs/common';

@Injectable()
export class CleanupJob {
  async runCleanup(): Promise<{ cleanedAt: string }> {
    return { cleanedAt: new Date().toISOString() };
  }
}