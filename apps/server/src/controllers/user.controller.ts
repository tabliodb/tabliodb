import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { UserCreateDto, UserListQueryDto, UserListResponseDto, UserResponseDto } from '../dtos/user.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { UserService } from '../services/user.service.js';

@ApiTags('users')
@Controller('users')
@Authenticated()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUsers(@Auth() auth: AuthContext, @Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    return this.userService.getAll(auth, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Auth() auth: AuthContext, @Body() dto: UserCreateDto): Promise<UserResponseDto> {
    return this.userService.create(auth, dto);
  }
}
