/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'john_doe',
    description: 'Unique username (alphanum, 3-30 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  username: string;

  @ApiProperty({ example: 'John Doe', description: 'Display name (2-50 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(50, { message: 'Display name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  displayName: string;

  @ApiProperty({
    example: 'MySecurePass123!',
    description: 'Password (min 8 chars, must contain uppercase, lowercase, number)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token from email link' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Valid refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'New password must contain uppercase, lowercase, and number',
  })
  newPassword: string;
}
