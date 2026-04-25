import { Injectable } from '@nestjs/common';
import { buildUploadPath } from './utils/upload.util';

@Injectable()
export class UploadService {
  resolveUploadPath(fileName: string) {
    return {
      fileName,
      path: buildUploadPath(fileName),
    };
  }
}
