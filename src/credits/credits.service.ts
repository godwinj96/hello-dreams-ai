import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageTracking } from '../admin/entities/usage-tracking.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { PaymentsService } from '../payments/payments.service';
import { BillingCycle } from '../payments/entities/subscription.entity';

export interface CreditStatus {
  plan: 'free' | 'pro';
  subscription: {
    status: string;
    billingCycle: BillingCycle;
    nextBillingDate: string;
  } | null;
  daily: {
    usedCredits: number;
    limitCredits: number;
    remainingCredits: number;
    usedTokens: number;
    limitTokens: number;
    resetsAt: string;
  };
  balanceCredits: number;
  tokensPerCredit: number;
  exempt: boolean;
}

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
    private configService: ConfigService,
  ) {}

  async getCreditStatus(user: User): Promise<CreditStatus> {
    const exempt = user.role === Role.Admin || user.role === Role.Superuser;

    const tokensPerCredit = this.configService.get<number>(
      'TOKENS_PER_CREDIT',
      800,
    );

    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);

    const tomorrowMidnightUtc = new Date(todayMidnightUtc);
    tomorrowMidnightUtc.setUTCDate(tomorrowMidnightUtc.getUTCDate() + 1);

    const subscription = await this.paymentsService.getActiveUserSubscription(
      user.id,
    );

    const limitCredits = subscription
      ? this.configService.get<number>('PRO_DAILY_CREDITS', 100)
      : this.configService.get<number>('FREE_DAILY_CREDITS', 5);

    const limitTokens = limitCredits * tokensPerCredit;

    const raw = await this.usageTrackingRepository
      .createQueryBuilder('ut')
      .select('COALESCE(SUM(ut.creditsConsumed), 0)', 'usedCredits')
      .addSelect('COALESCE(SUM(ut.tokensUsed), 0)', 'usedTokens')
      .where('ut.userId = :userId', { userId: user.id })
      .andWhere('ut.createdAt >= :since', { since: todayMidnightUtc })
      .getRawOne<{ usedCredits: string; usedTokens: string }>();

    const usedCredits = Math.round(Number(raw?.usedCredits ?? 0) * 100) / 100;
    const usedTokens = Number(raw?.usedTokens ?? 0);

    const freshUser = await this.userRepository.findOne({
      where: { id: user.id },
    });
    const balanceCredits = freshUser?.credits ?? user.credits ?? 0;

    const remainingCredits = exempt
      ? -1
      : Math.max(0, Math.round((limitCredits - usedCredits) * 100) / 100);

    return {
      plan: subscription ? 'pro' : 'free',
      subscription: subscription
        ? {
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            nextBillingDate: subscription.currentPeriodEnd.toISOString(),
          }
        : null,
      daily: {
        usedCredits,
        limitCredits,
        remainingCredits,
        usedTokens,
        limitTokens,
        resetsAt: tomorrowMidnightUtc.toISOString(),
      },
      balanceCredits,
      tokensPerCredit,
      exempt,
    };
  }
}
