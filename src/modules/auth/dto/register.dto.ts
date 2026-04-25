/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({ example: '+15551234567', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiProperty({
    example: 'john_doe',
    description: 'Unique username (alphanum, 3-30 chars)',
  })
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  username?: string;

  @ApiProperty({ example: 'tenant-01', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    example: false,
    required: false,
    description:
      'When true, account verification is done with OTP instead of email link',
  })
  @IsOptional()
  @IsBoolean()
  otpVerification?: boolean;

  @ApiProperty({
    example: 'email',
    required: false,
    enum: ['email', 'phone'],
    description: 'Preferred channel for OTP verification',
  })
  @IsOptional()
  @IsIn(['email', 'phone'])
  verificationChannel?: 'email' | 'phone';

  @ApiProperty({
    example: 'MySecurePass123!',
    required: false,
    description:
      'Password (min 8 chars, must contain uppercase, lowercase, number)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

export class OtpSendDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email or phone' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  identifier: string;

  @ApiProperty({ example: 'email', enum: ['email', 'phone'] })
  @IsString()
  @IsIn(['email', 'phone'])
  channel: 'email' | 'phone';

  @ApiProperty({ example: 'tenant-01', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    example: 'login',
    enum: ['login', 'account_verification', 'password_reset'],
    required: false,
  })
  @IsOptional()
  @IsIn(['login', 'account_verification', 'password_reset'])
  purpose?: 'login' | 'account_verification' | 'password_reset';
}

export class OtpVerifyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @ApiProperty({ example: 'tenant-01', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    example: 'login',
    enum: ['login', 'account_verification', 'password_reset'],
    required: false,
  })
  @IsOptional()
  @IsIn(['login', 'account_verification', 'password_reset'])
  purpose?: 'login' | 'account_verification' | 'password_reset';

  @ApiProperty({
    example: '253b75f5f61244e1887f0a95d4115dc4',
    required: false,
    description: 'Optional OTP verification token returned from /auth/otp/send',
  })
  @IsOptional()
  @IsString()
  token?: string;
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
