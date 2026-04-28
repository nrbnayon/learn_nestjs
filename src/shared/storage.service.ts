import {
  BadRequestException,
  Injectable,
  Logger,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

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

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain'];
const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOC_TYPES,
];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly driver: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>(
      'storage.uploadDir',
      'uploads',
    );
    this.maxFileSize = this.configService.get<number>(
      'storage.maxFileSize',
      10485760,
    );
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
    return this.uploadToLocal(
      file,
      subfolder || this.getCategory(file.mimetype),
    );
  }

  async uploadFiles(
    files: MulterFile[],
    subfolder = '',
  ): Promise<UploadedFile[]> {
    if (!files.length) return [];

    const uploadedFiles: UploadedFile[] = [];
    for (const file of files) {
      uploadedFiles.push(await this.uploadFile(file, subfolder));
    }

    return uploadedFiles;
  }

  async uploadAvatar(file: MulterFile): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Avatar must be JPEG, PNG, GIF or WebP',
      );
    }
    const result = await this.uploadToLocal(file, 'avatars');
    return result.url;
  }

  async deleteFile(keyOrUrl: string): Promise<void> {
    const normalizedKey = this.normalizeKey(keyOrUrl);
    if (!normalizedKey) return;

    const filePath = path.join(this.uploadDir, normalizedKey);
    try {
      await fsp.unlink(filePath);
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Could not delete file ${filePath}: ${message}`);
    }
  }

  async deleteFiles(keys: Array<string | null | undefined>): Promise<void> {
    await Promise.all(keys.map((key) => (key ? this.deleteFile(key) : null)));
  }

  private async uploadToLocal(
    file: MulterFile,
    folder: string,
  ): Promise<UploadedFile> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const key = [folder, filename]
      .filter(Boolean)
      .join('/')
      .replace(/\\/g, '/');
    const filePath = path.join(this.uploadDir, key);
    await fsp.writeFile(filePath, file.buffer);
    this.logger.debug(`File saved: ${filePath}`);
    return {
      url: `/uploads/${key}`,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      key,
    };
  }

  private validateFile(file: MulterFile): void {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File too large. Max size: ${this.maxFileSize} bytes`,
      );
    }
    if (!ALL_ALLOWED_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `File type "${file.mimetype}" not allowed`,
      );
    }
  }

  private getCategory(mimeType: string): string {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'images';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'videos';
    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
    return 'documents';
  }

  private normalizeKey(keyOrUrl: string): string {
    const withoutHost = keyOrUrl.replace(/^https?:\/\/[^/]+/i, '');
    const withoutPrefix = withoutHost
      .replace(/^\/+/, '')
      .replace(/^uploads\//i, '')
      .replace(/^uploads\\/i, '')
      .replace(/\\/g, '/');

    const normalized = path.posix.normalize(withoutPrefix);
    if (!normalized || normalized === '.' || normalized.startsWith('..')) {
      return '';
    }

    return normalized;
  }
}
