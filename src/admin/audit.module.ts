import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AuditLogService } from './services/audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
