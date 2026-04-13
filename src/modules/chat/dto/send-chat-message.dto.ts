import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ example: 'room_123' })
  @IsString()
  roomId: string;

  @ApiProperty({ example: 'Hello everyone' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ example: 'TEXT' })
  @IsOptional()
  @IsString()
  type?: string;
}