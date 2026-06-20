import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../users/enums/role.enum';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogFiltersDto } from '../dto/audit-log-filters.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Superuser)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List admin audit log entries' })
  @ApiResponse({ status: 200, description: 'Paginated audit log' })
  findAll(@Query() filters: AuditLogFiltersDto) {
    return this.auditLogService.findAll(filters);
  }
}
