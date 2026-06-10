import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageTracking } from './entities/usage-tracking.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Subscription } from '../payments/entities/subscription.entity';
import { UsageTrackingService } from './services/usage-tracking.service';
import { DashboardService } from './services/dashboard.service';
import { DashboardEventService } from './services/dashboard-event.service';
import { AuditLogService } from './services/audit-log.service';
import { AdminPaymentsService } from './services/admin-payments.service';
import { DashboardController } from './dashboard.controller';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { AuditModule } from './audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsageTracking,
      AdminAuditLog,
      User,
      Payment,
      Subscription,
    ]),
    AuditModule,
  ],
  controllers: [
    DashboardController,
    AdminPaymentsController,
    AuditLogController,
  ],
  providers: [
    UsageTrackingService,
    DashboardService,
    DashboardEventService,
    AdminPaymentsService,
  ],
  exports: [UsageTrackingService, DashboardEventService],
})
export class AdminModule {}
