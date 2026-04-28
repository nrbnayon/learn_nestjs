import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { PrismaModule } from '../../database/prisma.module';
import { CommonModule } from '../../common/common.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, CommonModule, UploadModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
