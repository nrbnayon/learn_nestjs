import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ type: [String], example: ['user-1', 'user-2'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  participantIds: string[];

  @ApiPropertyOptional({ example: 'Project discussion' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}