import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
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

	@Get(':id')
	@ApiOperation({ summary: 'Get a user by id' })
	getUser(@Param('id') userId: string) {
		return this.userService.getUserById(userId);
	}
}
