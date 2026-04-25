import { Injectable } from '@nestjs/common';

@Injectable()
export class CleanupJob {
  runCleanup(): { cleanedAt: string } {
    return { cleanedAt: new Date().toISOString() };
  }
}
