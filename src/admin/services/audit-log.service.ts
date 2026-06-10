import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditLogFiltersDto } from '../dto/audit-log-filters.dto';

export interface AuditLogEntryInput {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async log(entry: AuditLogEntryInput): Promise<AdminAuditLog> {
    const record = this.auditLogRepository.create(entry);
    return this.auditLogRepository.save(record);
  }

  async findAll(filters: AuditLogFiltersDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters.actorSearch) {
      qb.andWhere('log.actorEmail ILIKE :search', {
        search: `%${filters.actorSearch}%`,
      });
    }

    if (filters.startDate && filters.endDate) {
      qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
      });
    } else if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    } else if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', {
        endDate: new Date(filters.endDate),
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
