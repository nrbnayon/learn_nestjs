import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReadMessageDto {
  @ApiProperty({ example: 'message_123' })
  @IsString()
  messageId: string;

  @ApiProperty({ example: 'room_123' })
  @IsString()
  roomId: string;
}
