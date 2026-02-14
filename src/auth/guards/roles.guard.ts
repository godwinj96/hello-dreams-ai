import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  // Role hierarchy: superuser > admin > user
  private readonly roleHierarchy: Record<Role, Role[]> = {
    [Role.Superuser]: [Role.Superuser, Role.Admin, Role.User],
    [Role.Admin]: [Role.Admin, Role.User],
    [Role.User]: [Role.User],
  };

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }

    // Get all roles the user can access based on hierarchy
    const userAccessibleRoles = this.roleHierarchy[user.role] || [];
    
    // Check if any required role is in the user's accessible roles
    return requiredRoles.some((role) => userAccessibleRoles.includes(role));
  }
}

