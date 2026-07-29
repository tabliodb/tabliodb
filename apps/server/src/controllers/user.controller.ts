import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { UserCreateDto, UserResponseDto } from '../dtos/user.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { UserService } from '../services/user.service.js';

@ApiTags('users')
@Controller('users')
@Authenticated()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUsers(@Auth() auth: AuthContext): Promise<UserResponseDto[]> {
    return this.userService.getAll(auth);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Auth() auth: AuthContext, @Body() dto: UserCreateDto): Promise<UserResponseDto> {
    return this.userService.create(auth, dto);
  }
}
