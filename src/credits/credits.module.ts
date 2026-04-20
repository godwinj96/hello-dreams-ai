import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageTracking } from '../admin/entities/usage-tracking.entity';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { CreditGuard } from '../common/guards/credit.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UsageTracking])],
  controllers: [CreditsController],
  providers: [CreditsService, CreditGuard],
  exports: [CreditsService, CreditGuard],
})
export class CreditsModule {}
