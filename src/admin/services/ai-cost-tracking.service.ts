import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';
import { DEFAULT_NGN_TO_USD_RATE } from '../../shared/utils/cost-calculator.util';
import { CreditsTrackingService } from '../../credits/credits-tracking.service';

@Injectable()
export class AiCostTrackingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly creditsTrackingService: CreditsTrackingService,
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
    this.creditsTrackingService.recordAiUsage(
      userId,
      actionType,
      module,
      accumulator,
      extraMetadata,
    );
  }

  recordStandalone(
    userId: string,
    actionType: string,
    module: string,
    accumulator: AiCostAccumulator,
    extraMetadata?: Record<string, unknown>,
  ): void {
    this.recordFromAccumulator(
      userId,
      actionType,
      module,
      accumulator,
      extraMetadata,
    );
  }

  recordFlatUsage(
    userId: string,
    actionType: string,
    module: string,
    extraMetadata?: Record<string, unknown>,
  ): void {
    this.creditsTrackingService.recordFlatUsage(
      userId,
      actionType,
      module,
      extraMetadata,
    );
  }
}
