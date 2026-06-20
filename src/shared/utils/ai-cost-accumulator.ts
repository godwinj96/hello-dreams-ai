import {
  AiUsageBreakdownItem,
  ChatUsageInput,
  EmbeddingUsageInput,
  ImageUsageInput,
  SpeechUsageInput,
} from '../types/ai-usage.types';
import {
  calculateChatCost,
  calculateEmbeddingCost,
  calculateImageCost,
  calculateWhisperCost,
  CostCalculation,
  DEFAULT_NGN_TO_USD_RATE,
} from './cost-calculator.util';

export class AiCostAccumulator {
  private readonly breakdown: AiUsageBreakdownItem[] = [];
  private totalCostUsd = 0;
  private totalCostNgn = 0;
  private totalTokens = 0;
  private hasEstimated = false;

  constructor(
    private readonly ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
  ) {}

  addChat(input: ChatUsageInput): CostCalculation {
    const cost = calculateChatCost(input.model, input.usage, this.ngnToUsdRate);
    this.record({
      operation: input.operation,
      model: input.model,
      provider: input.provider,
      tokensUsed: cost.tokensUsed,
      costUsd: cost.costUsd,
      estimated: input.estimated,
    });
    return cost;
  }

  addEmbedding(input: EmbeddingUsageInput): CostCalculation {
    const cost = calculateEmbeddingCost(
      input.model,
      input.promptTokens,
      this.ngnToUsdRate,
    );
    this.record({
      operation: 'embedding',
      model: input.model,
      provider: input.provider,
      tokensUsed: cost.tokensUsed,
      costUsd: cost.costUsd,
    });
    return cost;
  }

  addImage(input: ImageUsageInput): CostCalculation {
    const cost = calculateImageCost(
      input.model,
      input.imageCount,
      input.size,
      input.quality,
      this.ngnToUsdRate,
    );
    this.record({
      operation: 'image',
      model: input.model,
      provider: input.provider,
      tokensUsed: 0,
      costUsd: cost.costUsd,
    });
    return cost;
  }

  addSpeech(input: SpeechUsageInput): CostCalculation {
    const cost = calculateWhisperCost(input.durationSeconds, this.ngnToUsdRate);
    this.record({
      operation: 'speech_to_text',
      model: input.model,
      provider: input.provider,
      tokensUsed: 0,
      costUsd: cost.costUsd,
      estimated: input.estimated ?? true,
    });
    return cost;
  }

  merge(other: AiCostAccumulator): void {
    for (const item of other.getBreakdown()) {
      this.record(item);
    }
  }

  getTotals(): CostCalculation {
    return {
      costUsd: Math.round(this.totalCostUsd * 1_000_000) / 1_000_000,
      costNgn: Math.round(this.totalCostNgn * 100) / 100,
      tokensUsed: this.totalTokens,
    };
  }

  getBreakdown(): AiUsageBreakdownItem[] {
    return [...this.breakdown];
  }

  hasEstimatedCosts(): boolean {
    return this.hasEstimated;
  }

  isEmpty(): boolean {
    return this.breakdown.length === 0;
  }

  private record(item: AiUsageBreakdownItem): void {
    this.breakdown.push(item);
    this.totalCostUsd += item.costUsd;
    this.totalCostNgn += item.costUsd * this.ngnToUsdRate;
    this.totalTokens += item.tokensUsed;
    if (item.estimated) {
      this.hasEstimated = true;
    }
  }
}
