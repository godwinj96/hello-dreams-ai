import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageTracking } from '../admin/entities/usage-tracking.entity';
import { User } from '../users/entities/user.entity';
import { PaymentsModule } from '../payments/payments.module';
import { CreditsService } from './credits.service';
import { CreditsTrackingService } from './credits-tracking.service';
import { CreditsController } from './credits.controller';
import { CreditGuard } from '../common/guards/credit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsageTracking, User]),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [CreditsController],
  providers: [CreditsService, CreditsTrackingService, CreditGuard],
  exports: [CreditsService, CreditsTrackingService, CreditGuard],
})
export class CreditsModule {}
