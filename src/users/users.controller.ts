import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { PromoteUserDto } from './dto/promote-user.dto';
import { UserResponseDto, UserStatsDto } from './dto/user-response.dto';
import { toUserResponseDto } from './utils/user.mapper';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @Roles(Role.User, Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  getProfile(@Request() req): UserResponseDto {
    return toUserResponseDto(req.user);
  }

  @Get()
  @Roles(Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'List all users with filters (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(@Request() req, @Query() filters: UserFiltersDto) {
    return this.usersService.listUsers(req.user.id, filters);
  }

  @Get('stats')
  @Roles(Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'Get user statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User statistics',
    type: UserStatsDto,
  })
  getUserStats(@Request() req): Promise<UserStatsDto> {
    return this.usersService.getUserStats(req.user.id);
  }

  @Get(':id')
  @Roles(Role.User, Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'Get user by ID (self or admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getUserById(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.getUserById(req.user.id, id);
  }

  @Post('admins')
  @Roles(Role.Superuser)
  @ApiOperation({
    summary: 'Create admin or superuser account (superuser only)',
  })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({
    status: 201,
    description: 'Admin/superuser created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only superusers can create admins/superusers',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createAdmin(
    @Request() req,
    @Body() createAdminDto: CreateAdminDto,
  ): Promise<UserResponseDto> {
    return this.usersService.createAdmin(req.user.id, createAdminDto, req.ip);
  }

  @Patch(':id/promote')
  @Roles(Role.Superuser)
  @ApiOperation({
    summary: 'Promote user to admin or superuser (superuser only)',
  })
  @ApiParam({ name: 'id', description: 'User ID to promote' })
  @ApiBody({ type: PromoteUserDto })
  @ApiResponse({
    status: 200,
    description: 'User promoted successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only superusers can promote users',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid promotion request' })
  async promoteUser(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
    @Body() promoteDto: PromoteUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.promoteUser(
      req.user.id,
      id,
      promoteDto.role,
      req.ip,
    );
  }

  @Delete('admins/:id')
  @Roles(Role.Superuser)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove admin role (superuser only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'Admin role removed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only superusers can remove admins',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async removeAdmin(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    return this.usersService.removeAdmin(req.user.id, id, req.ip);
  }

  @Patch(':id/status')
  @Roles(Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'Update user status (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiResponse({
    status: 200,
    description: 'User status updated',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only admins can update user status',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserStatus(
      req.user.id,
      id,
      updateStatusDto.isActive,
      req.ip,
    );
  }

  @Put(':id')
  @Roles(Role.User, Role.Admin, Role.Superuser)
  @ApiOperation({ summary: 'Update user (self or admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateUser(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(req.user.id, id, updateUserDto, req.ip);
  }

  @Delete(':id')
  @Roles(Role.Superuser)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (superuser only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only superusers can delete users' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    return this.usersService.deleteUser(req.user.id, id, req.ip);
  }
}
