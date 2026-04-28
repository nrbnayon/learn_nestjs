import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OauthService } from './oauth.service';

@ApiTags('oauth')
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('google')
  @ResponseMessage('Google login successful')
  loginWithGoogle(
    @Body()
    dto: {
      idToken: string;
      tenantId?: string;
      tenantDomain?: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    return this.oauthService.loginWithGoogle(dto);
  }

  @Post('connect')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Provider account connected successfully')
  connectProvider(
    @CurrentUser('id') userId: string,
    @Body()
    dto: {
      provider: 'google' | 'github' | 'facebook' | 'linkedin';
      providerAccountId?: string;
      idToken?: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    return this.oauthService.connectProvider(userId, dto);
  }

  @Post('google/callback')
  @ResponseMessage('Google token exchange successful')
  async exchangeGoogleCode(
    @Body()
    dto: {
      code: string;
      redirectUri: string;
    },
  ) {
    return this.oauthService.exchangeGoogleAuthCode(dto.code, dto.redirectUri);
  }
}
