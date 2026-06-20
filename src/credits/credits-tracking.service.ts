import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageTracking } from '../admin/entities/usage-tracking.entity';
import { AiCostAccumulator } from '../shared/utils/ai-cost-accumulator';
import { AiUsageMetadata } from '../shared/types/ai-usage.types';
import { PaymentsService } from '../payments/payments.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class CreditsTrackingService {
  private readonly logger = new Logger(CreditsTrackingService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @InjectRepository(UsageTracking)
    private readonly usageTrackingRepository: Repository<UsageTracking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  computeCredits(tokensUsed: number): number {
    const minCredits = this.configService.get<number>('MIN_CREDITS_PER_OP', 1);
    const tokensPerCredit = this.configService.get<number>(
      'TOKENS_PER_CREDIT',
      800,
    );

    if (tokensUsed <= 0) {
      return minCredits;
    }

    return Math.max(minCredits, Math.ceil(tokensUsed / tokensPerCredit));
  }

  computeCreditsForOperation(tokensUsed: number, actionType: string): number {
    if (tokensUsed > 0) {
      return this.computeCredits(tokensUsed);
    }
    return this.getFlatCreditCost(actionType);
  }

  getFlatCreditCost(actionType: string): number {
    const minCredits = this.configService.get<number>('MIN_CREDITS_PER_OP', 1);

    switch (actionType) {
      case 'headshots_generated':
        return this.configService.get<number>('HEADSHOT_CREDIT_COST', 5);
      case 'ai_speech_to_text':
      case 'voice_message':
        return this.configService.get<number>('VOICE_CREDIT_COST', 2);
      case 'cv_upload':
        return this.configService.get<number>('CV_UPLOAD_CREDIT_COST', 1);
      default:
        return minCredits;
    }
  }

  recordAiUsage(
    userId: string,
    actionType: string,
    module: string,
    accumulator: AiCostAccumulator,
    extraMetadata?: Record<string, unknown>,
  ): void {
    if (accumulator.isEmpty()) {
      return;
    }

    this.recordAiUsageAsync(
      userId,
      actionType,
      module,
      accumulator,
      extraMetadata,
    ).catch((err) =>
      this.logger.error('Failed to record AI usage credits:', err),
    );
  }

  recordFlatUsage(
    userId: string,
    actionType: string,
    module: string,
    extraMetadata?: Record<string, unknown>,
  ): void {
    this.recordFlatUsageAsync(userId, actionType, module, extraMetadata).catch(
      (err) => this.logger.error('Failed to record flat credit usage:', err),
    );
  }

  private async recordAiUsageAsync(
    userId: string,
    actionType: string,
    module: string,
    accumulator: AiCostAccumulator,
    extraMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const totals = accumulator.getTotals();
    const creditsConsumed = this.computeCreditsForOperation(
      totals.tokensUsed,
      actionType,
    );

    const metadata: AiUsageMetadata = {
      ...extraMetadata,
      breakdown: accumulator.getBreakdown(),
      estimated: accumulator.hasEstimatedCosts() || undefined,
    };

    const primary = accumulator.getBreakdown()[0];
    if (primary) {
      metadata.operation = primary.operation;
      metadata.provider = primary.provider;
      metadata.model = primary.model;
    }

    await this.persistUsage(
      userId,
      actionType,
      module,
      totals.tokensUsed,
      totals.costUsd,
      totals.costNgn,
      creditsConsumed,
      metadata,
    );
  }

  private async recordFlatUsageAsync(
    userId: string,
    actionType: string,
    module: string,
    extraMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const creditsConsumed = this.getFlatCreditCost(actionType);

    await this.persistUsage(
      userId,
      actionType,
      module,
      0,
      0,
      0,
      creditsConsumed,
      extraMetadata,
    );
  }

  private async persistUsage(
    userId: string,
    actionType: string,
    module: string,
    tokensUsed: number,
    costUsd: number,
    costNgn: number,
    creditsConsumed: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const usedCreditsBefore = await this.getDailyUsedCredits(userId);
    const limitCredits = await this.getDailyLimitCredits(userId);

    await this.usageTrackingRepository.save(
      this.usageTrackingRepository.create({
        userId,
        actionType,
        module,
        tokensUsed,
        costUsd,
        costNgn,
        creditsConsumed,
        metadata,
      }),
    );

    await this.applyPrepaidDeduction(
      userId,
      creditsConsumed,
      usedCreditsBefore,
      limitCredits,
    );
  }

  async getDailyUsedCredits(userId: string): Promise<number> {
    const todayMidnightUtc = this.getTodayMidnightUtc();
    const raw = await this.usageTrackingRepository
      .createQueryBuilder('ut')
      .select('COALESCE(SUM(ut.creditsConsumed), 0)', 'usedCredits')
      .where('ut.userId = :userId', { userId })
      .andWhere('ut.createdAt >= :since', { since: todayMidnightUtc })
      .getRawOne<{ usedCredits: string }>();

    return Math.round(Number(raw?.usedCredits ?? 0) * 100) / 100;
  }

  async getDailyLimitCredits(userId: string): Promise<number> {
    const subscription =
      await this.paymentsService.getActiveUserSubscription(userId);

    if (subscription) {
      return this.configService.get<number>('PRO_DAILY_CREDITS', 100);
    }

    return this.configService.get<number>('FREE_DAILY_CREDITS', 5);
  }

  private async applyPrepaidDeduction(
    userId: string,
    creditsConsumed: number,
    usedCreditsBefore: number,
    limitCredits: number,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.role === Role.Admin || user.role === Role.Superuser) {
      return;
    }

    const dailyRemainingBefore = Math.max(0, limitCredits - usedCreditsBefore);
    const fromDaily = Math.min(creditsConsumed, dailyRemainingBefore);
    const fromPrepaid = creditsConsumed - fromDaily;

    if (fromPrepaid <= 0) {
      return;
    }

    try {
      await this.paymentsService.deductCredits(userId, fromPrepaid);
    } catch (err) {
      this.logger.warn(
        `Prepaid deduction failed for user ${userId}: ${fromPrepaid} credits`,
        err,
      );
    }
  }

  private getTodayMidnightUtc(): Date {
    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);
    return todayMidnightUtc;
  }
}
