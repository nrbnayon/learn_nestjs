import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionService } from './session.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('users/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.sessionService.findByUser(userId);
  }

  @Delete('users/:userId')
  revokeAll(@Param('userId') userId: string) {
    return this.sessionService.revokeAll(userId);
  }
}
