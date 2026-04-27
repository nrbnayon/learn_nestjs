import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  OtpSendDto,
  OtpVerifyDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ResponseMessage('Registration successful. Please verify your account.')
  register(
    @Body() dto: RegisterDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-tenant-domain') tenantDomain?: string,
    @Req() req?: FastifyRequest,
  ) {
    return this.authService.register(dto, {
      tenantId,
      tenantDomain,
      ipAddress: req?.ip,
      userAgent:
        typeof req?.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Unified login (password, OTP, OAuth account)' })
  @ResponseMessage('Login successful')
  login(
    @Body() dto: LoginDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-tenant-domain') tenantDomain?: string,
    @Req() req?: FastifyRequest,
  ) {
    return this.authService.login(dto, {
      tenantId,
      tenantDomain,
      ipAddress: req?.ip,
      userAgent:
        typeof req?.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @Public()
  @Post('otp/send')
  sendOtp(
    @Body() dto: OtpSendDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-tenant-domain') tenantDomain?: string,
  ) {
    return this.authService.sendOtp(dto, {
      tenantDomain,
      tenantId: dto.tenantId ?? tenantId,
    });
  }

  @Public()
  @Post('otp/verify')
  verifyOtp(
    @Body() dto: OtpVerifyDto,
    @Headers('x-tenant-domain') tenantDomain?: string,
    @Req() req?: FastifyRequest,
  ) {
    return this.authService.verifyOtp(dto, {
      tenantDomain,
      tenantId: dto.tenantId,
      ipAddress: req?.ip,
      userAgent:
        typeof req?.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @Public()
  @Post('refresh-token')
  @ResponseMessage('Tokens refreshed successfully')
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Req() req?: FastifyRequest,
  ) {
    return this.authService.refreshTokens(dto, {
      tenantId,
      ipAddress: req?.ip,
      userAgent:
        typeof req?.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @Public()
  @Get('verify-email')
  async verifyEmailFromLink(
    @Query('token') token: string,
    @Query('platform') platform?: 'web' | 'app',
    @Res() reply?: FastifyReply,
  ) {
    if (!token) {
      throw new BadRequestException('token is required');
    }

    const resolvedPlatform: 'web' | 'app' = platform === 'app' ? 'app' : 'web';

    try {
      await this.authService.verifyEmail({ token });
      return this.redirectVerificationReply(
        reply,
        this.authService.getVerifyEmailRedirectUrl(resolvedPlatform, 'success'),
        resolvedPlatform,
        'success',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Verification failed';
      return this.redirectVerificationReply(
        reply,
        this.authService.getVerifyEmailRedirectUrl(resolvedPlatform, 'failure'),
        resolvedPlatform,
        'failure',
        message,
      );
    }
  }

  private redirectVerificationReply(
    reply: FastifyReply | undefined,
    redirectBaseUrl: string,
    platform: 'web' | 'app',
    status: 'success' | 'failure',
    message?: string,
  ) {
    if (typeof reply === 'undefined') {
      throw new BadRequestException('Unable to create redirect response');
    }

    const redirectUrl = new URL(redirectBaseUrl);
    redirectUrl.searchParams.set('status', status);
    redirectUrl.searchParams.set('platform', platform);
    if (message) {
      redirectUrl.searchParams.set('message', message);
    }

    return reply.status(302).header('Location', redirectUrl.toString()).send();
  }

  @Public()
  @Post('verify-email')
  @ResponseMessage('Email verified successfully')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @ResponseMessage('If the account exists, a password reset link has been sent')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ResponseMessage('Password reset successfully. Now you can login.')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser('id') userId: string, @Req() req?: FastifyRequest) {
    const authHeader = req?.headers?.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    return this.authService.logout(userId, {
      accessToken,
      ipAddress: req?.ip,
      userAgent:
        typeof req?.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ResponseMessage('Password changed successfully')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }
}
