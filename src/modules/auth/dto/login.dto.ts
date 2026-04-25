/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'email | username | phone',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  identifier: string;

  @ApiProperty({
    example: 'MySecurePass123!',
    required: false,
    description: 'Required for identifier+password flow',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    example: '123456',
    required: false,
    description: 'Required for OTP flow',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6 digit code' })
  otp?: string;

  @ApiProperty({
    example: 'google',
    required: false,
    enum: ['google', 'github', 'facebook', 'linkedin'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['google', 'github', 'facebook', 'linkedin'])
  provider?: 'google' | 'github' | 'facebook' | 'linkedin';
}
