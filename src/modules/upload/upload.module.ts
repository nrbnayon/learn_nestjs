import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { StorageService } from '../../shared/storage.service';

@Module({
  controllers: [UploadController],
  providers: [UploadService, StorageService],
  exports: [UploadService, StorageService],
})
export class UploadModule {}
