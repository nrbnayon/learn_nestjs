import { Body, Controller, Post } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('path')
  resolveUploadPath(@Body('fileName') fileName: string) {
    return this.uploadService.resolveUploadPath(fileName);
  }
}