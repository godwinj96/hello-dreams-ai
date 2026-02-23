import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageTracking } from './entities/usage-tracking.entity';
import { User } from '../users/entities/user.entity';
import { UsageTrackingService } from './services/usage-tracking.service';
import { DashboardService } from './services/dashboard.service';
import { DashboardEventService } from './services/dashboard-event.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UsageTracking, User])],
  controllers: [DashboardController],
  providers: [
    UsageTrackingService,
    DashboardService,
    DashboardEventService,
  ],
  exports: [UsageTrackingService, DashboardEventService],
})
export class AdminModule {}






