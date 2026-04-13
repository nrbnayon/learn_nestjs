import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, RefreshTokenDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post('register')
	@ApiOperation({ summary: 'Register a new user' })
	register(@Body() dto: RegisterDto) {
		return this.authService.register(dto);
	}

	@Public()
	@Post('login')
	@ApiOperation({ summary: 'Login with email and password' })
	login(@Body() dto: LoginDto) {
		return this.authService.login(dto);
	}

	@Public()
	@Post('refresh-token')
	refreshToken(@Body() dto: RefreshTokenDto) {
		return this.authService.refreshTokens(dto);
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
	logout(@CurrentUser('id') userId: string) {
		return this.authService.logout(userId);
	}

	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@Post('change-password')
	changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
		return this.authService.changePassword(userId, dto);
	}
}
