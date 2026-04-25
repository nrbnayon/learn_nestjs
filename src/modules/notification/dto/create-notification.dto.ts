import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'SYSTEM' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'New message' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'You have a new message' })
  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
