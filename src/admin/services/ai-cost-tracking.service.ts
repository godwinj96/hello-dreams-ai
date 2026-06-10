import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';
import { AiUsageMetadata } from '../../shared/types/ai-usage.types';
import { DEFAULT_NGN_TO_USD_RATE } from '../../shared/utils/cost-calculator.util';
import { UsageTrackingService } from './usage-tracking.service';

@Injectable()
export class AiCostTrackingService {
  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly configService: ConfigService,
  ) {}

  createAccumulator(): AiCostAccumulator {
    const rate = this.configService.get<number>(
      'NGN_TO_USD_RATE',
      DEFAULT_NGN_TO_USD_RATE,
    );
    return new AiCostAccumulator(rate);
  }

  getNgnToUsdRate(): number {
    return this.configService.get<number>(
      'NGN_TO_USD_RATE',
      DEFAULT_NGN_TO_USD_RATE,
    );
  }

  recordFromAccumulator(
    userId: string,
    actionType: string,
    module: string,
    accumulator: AiCostAccumulator,
    extraMetadata?: Record<string, unknown>,
  ): void {
    if (accumulator.isEmpty()) {
      return;
    }

    const totals = accumulator.getTotals();
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

    this.usageTrackingService
      .trackUsageWithCosts(
        userId,
        actionType,
        module,
        totals.tokensUsed,
        totals.costUsd,
        totals.costNgn,
        metadata,
      )
      .catch((err) => console.error('Failed to track AI usage:', err));
  }

  recordStandalone(
    userId: string,
    actionType: string,
    module: string,
    accumulator: AiCostAccumulator,
    extraMetadata?: Record<string, unknown>,
  ): void {
    this.recordFromAccumulator(userId, actionType, module, accumulator, extraMetadata);
  }
}
