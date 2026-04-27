import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.userService.getUserById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateMe(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users' })
  listUsers(@Query('search') search?: string) {
    return this.userService.listUsers(search);
  }

  @Get('presence/me')
  @ApiOperation({ summary: 'Get current user presence status' })
  getMyPresence(@CurrentUser('id') userId: string) {
    return this.userService.getPresenceByUserId(userId, userId);
  }

  @Get('presence/friends')
  @ApiOperation({ summary: 'Get accepted friends with real-time presence status' })
  getFriendsPresence(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.listFriendsPresence(userId, search, limit);
  }

  @Get('presence/active')
  @ApiOperation({ summary: 'Get active users (admin all, user friends only)' })
  getActiveUsers(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role?: string,
    @CurrentUser('tenantId') tenantId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.listActiveUsers({
      requesterId: userId,
      requesterRole: role,
      requesterTenantId: tenantId,
      search,
      limit,
    });
  }

  @Get('presence/:id')
  @ApiOperation({ summary: 'Get a user presence status (friend/self/admin)' })
  async getUserPresence(
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: string | undefined,
    @Param('id') targetUserId: string,
  ) {
    const allowed = await this.userService.canViewPresence(
      requesterId,
      targetUserId,
      requesterRole,
    );

    if (!allowed) {
      throw new ForbiddenException('You can only view your friends presence');
    }

    return this.userService.getPresenceByUserId(
      targetUserId,
      requesterId,
      requesterRole,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  getUser(@Param('id') userId: string) {
    return this.userService.getUserById(userId);
  }
}
