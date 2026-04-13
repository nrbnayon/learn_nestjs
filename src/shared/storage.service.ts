import { Injectable, Logger, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

export interface UploadedFile {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  key: string;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_DOC_TYPES];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly driver: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('storage.uploadDir', 'uploads');
    this.maxFileSize = this.configService.get<number>('storage.maxFileSize', 10485760);
    this.driver = this.configService.get<string>('storage.driver', 'local');
    this.ensureUploadDirs();
  }

  private ensureUploadDirs(): void {
    ['', 'images', 'videos', 'audio', 'documents', 'avatars'].forEach((sub) => {
      const dir = sub ? path.join(this.uploadDir, sub) : this.uploadDir;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  async uploadFile(file: MulterFile, subfolder = ''): Promise<UploadedFile> {
    this.validateFile(file);
    return this.uploadToLocal(file, subfolder || this.getCategory(file.mimetype));
  }

  async uploadAvatar(file: MulterFile): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Avatar must be JPEG, PNG, GIF or WebP');
    }
    const result = await this.uploadToLocal(file, 'avatars');
    return result.url;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    try {
      await fsp.unlink(filePath);
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (err) {
      this.logger.warn(`Could not delete file ${filePath}: ${err.message}`);
    }
  }

  private async uploadToLocal(file: MulterFile, folder: string): Promise<UploadedFile> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const key = path.join(folder, filename).replace(/\\/g, '/');
    const filePath = path.join(this.uploadDir, key);
    await fsp.writeFile(filePath, file.buffer);
    this.logger.debug(`File saved: ${filePath}`);
    return { url: `/uploads/${key}`, name: file.originalname, mimeType: file.mimetype, size: file.size, key };
  }

  private validateFile(file: MulterFile): void {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File too large. Max size: ${this.maxFileSize} bytes`);
    }
    if (!ALL_ALLOWED_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(`File type "${file.mimetype}" not allowed`);
    }
  }

  private getCategory(mimeType: string): string {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'images';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'videos';
    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
    return 'documents';
  }
}
