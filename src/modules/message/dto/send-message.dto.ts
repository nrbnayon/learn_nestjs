import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  // IsUUID,
  // MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '@prisma/client';

export class MessageAttachmentDto {
  @ApiPropertyOptional({ example: 'messages/uuid.jpg' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ example: 'https://example.com/file.jpg' })
  @IsString()
  url: string;

  @ApiProperty({ example: 'image.jpg' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType: string;

  @ApiProperty({ example: 1024 })
  @IsInt()
  size: number;

  @ApiPropertyOptional({ example: 800 })
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsInt()
  height?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Duration in seconds for audio/video',
  })
  @IsOptional()
  @IsInt()
  duration?: number;
}

export class SendMessageDto {
  @ApiProperty({ example: 'room-uuid' })
  @IsString()
  roomId: string;

  @ApiPropertyOptional({ example: 'Hello world' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    example: 'TEXT',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ example: 'message-uuid-to-reply-to' })
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
