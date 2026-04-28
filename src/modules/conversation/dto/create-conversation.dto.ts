import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2'],
    description:
      'User IDs to add as members (excluding yourself — you are added automatically)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: string[];

  @ApiPropertyOptional({
    example: 'Project Discussion',
    description: 'Required only for group chats',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'GROUP',
    enum: ['DIRECT', 'GROUP'],
    default: 'DIRECT',
  })
  @IsOptional()
  @IsEnum(['DIRECT', 'GROUP'])
  type?: 'DIRECT' | 'GROUP';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ example: 'A group for backend developers' })
  @IsOptional()
  @IsString()
  description?: string;
}
