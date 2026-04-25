import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCallDto {
  @ApiProperty({ example: 'room_123' })
  @IsString()
  roomId: string;

  @ApiProperty({ example: 'audio' })
  @IsString()
  type: string;
}
