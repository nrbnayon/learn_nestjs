import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post('register')
	@ApiOperation({ summary: 'Register a new user' })
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
			userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
		});
	}

	@Public()
	@Post('login')
	@ApiOperation({ summary: 'Unified login (password, OTP, OAuth account)' })
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
			userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
		});
	}

	@Public()
	@Post('otp/send')
	sendOtp(@Body() dto: OtpSendDto, @Headers('x-tenant-domain') tenantDomain?: string) {
		return this.authService.sendOtp(dto, {
			tenantDomain,
			tenantId: dto.tenantId,
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
			userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
		});
	}

	@Public()
	@Post('refresh-token')
	refreshToken(
		@Body() dto: RefreshTokenDto,
		@Headers('x-tenant-id') tenantId?: string,
		@Req() req?: FastifyRequest,
	) {
		return this.authService.refreshTokens(dto, {
			tenantId,
			ipAddress: req?.ip,
			userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
		});
	}

	@Public()
	@Get('verify-email')
	verifyEmailFromLink(@Query('token') token: string) {
		return this.authService.verifyEmail({ token });
	}

	@Public()
	@Post('verify-email')
	verifyEmail(@Body() dto: VerifyEmailDto) {
		return this.authService.verifyEmail(dto);
	}

	@Public()
	@Post('forgot-password')
	forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.forgotPassword(dto);
	}

	@Public()
	@Post('reset-password')
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
		const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
		return this.authService.logout(userId, {
			accessToken,
			ipAddress: req?.ip,
			userAgent: typeof req?.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
		});
	}

	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@Post('change-password')
	changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
		return this.authService.changePassword(userId, dto);
	}
}
