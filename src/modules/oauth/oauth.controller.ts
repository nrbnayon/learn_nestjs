import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OauthService } from './oauth.service';

@ApiTags('oauth')
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('connect')
  connectProvider(
    @Body()
    dto: {
      userId: string;
      provider: 'google' | 'github' | 'facebook' | 'linkedin';
      providerAccountId: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    return this.oauthService.connectProvider(dto);
  }
}
