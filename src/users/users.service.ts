import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './enums/role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UserResponseDto, UserStatsDto } from './dto/user-response.dto';
import { toUserResponseDto, toUserResponseDtos } from './utils/user.mapper';
import { AuditLogService } from '../admin/services/audit-log.service';
import { AuditAction } from '../admin/enums/audit-action.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private auditLogService: AuditLogService,
  ) {}

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
    const user = await this.findOne(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async createAdmin(
    userId: string,
    adminData: CreateAdminDto,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const requester = await this.findOne(userId);
    if (!requester || requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can create admins');
    }

    const targetRole = adminData.role || Role.Admin;

    if (targetRole === Role.Superuser && requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can create superuser accounts');
    }

    const existingUser = await this.findByEmail(adminData.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    const admin = await this.create({
      ...adminData,
      password: hashedPassword,
      role: targetRole,
      isActive: true,
    });

    await this.auditLogService.log({
      actorId: requester.id,
      actorEmail: requester.email,
      action: AuditAction.AdminCreated,
      targetType: 'user',
      targetId: admin.id,
      metadata: { email: admin.email, role: admin.role },
      ipAddress,
    });

    return toUserResponseDto(admin);
  }

  async promoteUser(
    userId: string,
    targetUserId: string,
    targetRole: Role,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const requester = await this.findOne(userId);
    if (!requester || !requester.isActive) {
      throw new ForbiddenException('Requester is not authorized or inactive');
    }

    const targetUser = await this.findOne(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can promote users');
    }

    if (targetUserId === userId && targetRole !== Role.Superuser) {
      throw new BadRequestException('A superuser cannot demote themselves');
    }

    if (targetRole === Role.Superuser && requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can promote users to superuser');
    }

    if (targetUser.role === Role.Superuser && targetRole !== Role.Superuser && targetUserId !== userId) {
      throw new ForbiddenException('Cannot demote another superuser');
    }

    const previousRole = targetUser.role;
    const updated = await this.update(targetUserId, { role: targetRole, isActive: true });

    await this.auditLogService.log({
      actorId: requester.id,
      actorEmail: requester.email,
      action: AuditAction.UserPromoted,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { previousRole, newRole: targetRole, email: targetUser.email },
      ipAddress,
    });

    return toUserResponseDto(updated);
  }

  async removeAdmin(
    userId: string,
    targetUserId: string,
    ipAddress?: string,
  ): Promise<void> {
    const requester = await this.findOne(userId);
    if (!requester || requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can remove admins');
    }

    const targetUser = await this.findOne(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.role !== Role.Admin && targetUser.role !== Role.Superuser) {
      throw new BadRequestException('User is not an admin or superuser');
    }

    if (targetUser.role === Role.Superuser) {
      throw new BadRequestException('Cannot remove superuser role. Use promote endpoint to change role.');
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot remove your own admin role');
    }

    await this.update(targetUserId, { role: Role.User });

    await this.auditLogService.log({
      actorId: requester.id,
      actorEmail: requester.email,
      action: AuditAction.UserDemoted,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { previousRole: targetUser.role, email: targetUser.email },
      ipAddress,
    });
  }

  async updateUserStatus(
    userId: string,
    targetUserId: string,
    isActive: boolean,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const requester = await this.findOne(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (requester.role !== Role.Admin && requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only admins can update user status');
    }

    const targetUser = await this.findOne(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      targetUser.role === Role.Superuser &&
      requester.role !== Role.Superuser
    ) {
      throw new ForbiddenException('Cannot modify superuser status');
    }

    if (targetUserId === userId && !isActive) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const updated = await this.update(targetUserId, { isActive });

    await this.auditLogService.log({
      actorId: requester.id,
      actorEmail: requester.email,
      action: isActive ? AuditAction.UserActivated : AuditAction.UserDeactivated,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { email: targetUser.email, isActive },
      ipAddress,
    });

    return toUserResponseDto(updated);
  }

  async getUserById(userId: string, targetUserId: string): Promise<UserResponseDto> {
    const requester = await this.findOne(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (targetUserId !== userId) {
      if (requester.role !== Role.Admin && requester.role !== Role.Superuser) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    const user = await this.findOne(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserResponseDto(user);
  }

  async updateUser(
    userId: string,
    targetUserId: string,
    updateData: UpdateUserDto,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const requester = await this.findOne(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (targetUserId !== userId) {
      if (requester.role !== Role.Admin && requester.role !== Role.Superuser) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    const targetUser = await this.findOne(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (updateData.email && updateData.email !== targetUser.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    const roleChanged =
      updateData.role !== undefined && updateData.role !== targetUser.role;

    if (roleChanged) {
      if (requester.role !== Role.Superuser) {
        throw new ForbiddenException('Cannot change user role. Use the promote endpoint instead.');
      }
      if (updateData.role === Role.Superuser && requester.role !== Role.Superuser) {
        throw new ForbiddenException('Only superusers can promote users to superuser');
      }
      if (targetUser.role === Role.Superuser && updateData.role !== Role.Superuser && targetUserId !== userId) {
        throw new ForbiddenException('Cannot demote another superuser');
      }
      if (targetUserId === userId && updateData.role !== Role.Superuser) {
        throw new BadRequestException('A superuser cannot demote themselves');
      }
    }

    if (updateData.isActive === false && targetUserId === userId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    if (targetUser.role === Role.Superuser && requester.role === Role.Admin) {
      if (updateData.role !== undefined || updateData.isActive === false) {
        throw new ForbiddenException('Admins cannot modify superuser accounts');
      }
    }

    const updated = await this.update(targetUserId, updateData);

    if (roleChanged || Object.keys(updateData).some((k) => k !== 'role')) {
      await this.auditLogService.log({
        actorId: requester.id,
        actorEmail: requester.email,
        action: roleChanged ? AuditAction.UserPromoted : AuditAction.UserUpdated,
        targetType: 'user',
        targetId: targetUserId,
        metadata: {
          email: targetUser.email,
          changes: updateData,
          previousRole: roleChanged ? targetUser.role : undefined,
        },
        ipAddress,
      });
    }

    return toUserResponseDto(updated);
  }

  async deleteUser(
    userId: string,
    targetUserId: string,
    ipAddress?: string,
  ): Promise<void> {
    const requester = await this.findOne(userId);
    if (!requester || requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only superusers can delete users');
    }

    const targetUser = await this.findOne(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUserId === userId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    await this.auditLogService.log({
      actorId: requester.id,
      actorEmail: requester.email,
      action: AuditAction.UserDeleted,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { email: targetUser.email, role: targetUser.role },
      ipAddress,
    });

    await this.usersRepository.remove(targetUser);
  }

  async listUsers(userId: string, filters: UserFiltersDto) {
    const requester = await this.findOne(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (requester.role !== Role.Admin && requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only admins can list users');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [users, total] = await this.usersRepository.findAndCount({
      where: filters.search
        ? [
            { ...where, email: Like(`%${filters.search}%`) },
            { ...where, name: Like(`%${filters.search}%`) },
          ]
        : where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: toUserResponseDtos(users),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserStats(userId: string): Promise<UserStatsDto> {
    const requester = await this.findOne(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (requester.role !== Role.Admin && requester.role !== Role.Superuser) {
      throw new ForbiddenException('Only admins can view user statistics');
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, inactiveUsers, allUsers] =
      await Promise.all([
        this.usersRepository.count(),
        this.usersRepository.count({ where: { isActive: true } }),
        this.usersRepository.count({ where: { isActive: false } }),
        this.usersRepository.find({ select: ['role'] }),
      ]);

    const usersByRole = allUsers.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      {} as Record<Role, number>,
    );

    const [newUsersLast24h, newUsersLast7d, newUsersLast30d] =
      await Promise.all([
        this.usersRepository
          .createQueryBuilder('user')
          .where('user.createdAt >= :date', { date: last24h })
          .getCount(),
        this.usersRepository
          .createQueryBuilder('user')
          .where('user.createdAt >= :date', { date: last7d })
          .getCount(),
        this.usersRepository
          .createQueryBuilder('user')
          .where('user.createdAt >= :date', { date: last30d })
          .getCount(),
      ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRole: {
        [Role.User]: usersByRole[Role.User] || 0,
        [Role.Admin]: usersByRole[Role.Admin] || 0,
        [Role.Superuser]: usersByRole[Role.Superuser] || 0,
      },
      newUsersLast24h,
      newUsersLast7d,
      newUsersLast30d,
    };
  }
}
