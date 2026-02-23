/**
 * Cost calculator utility for AI model usage
 * Calculates costs based on token usage and model pricing
 */

// Model pricing per 1M tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  'gpt-4o': {
    input: 2.5, // $2.50 per 1M input tokens
    output: 10.0, // $10.00 per 1M output tokens
  },
  'gpt-4': {
    input: 30.0, // $30.00 per 1M input tokens
    output: 60.0, // $60.00 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.5, // $0.50 per 1M input tokens
    output: 1.5, // $1.50 per 1M output tokens
  },
};

// Default NGN to USD exchange rate (should be configurable via env)
const DEFAULT_NGN_TO_USD_RATE = 1500; // 1 USD = 1500 NGN (approximate)

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  costUsd: number;
  costNgn: number;
  tokensUsed: number;
}

/**
 * Calculate cost based on token usage and model
 */
export function calculateCost(
  model: string,
  usage: TokenUsage,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const pricing = MODEL_PRICING[model.toLowerCase()];

  if (!pricing) {
    // Default to gpt-4o-mini pricing if model not found
    console.warn(`Unknown model ${model}, using gpt-4o-mini pricing`);
    return calculateCost('gpt-4o-mini', usage, ngnToUsdRate);
  }

  // Calculate cost in USD
  // Convert tokens to millions and multiply by price per million
  const inputCostUsd = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (usage.completionTokens / 1_000_000) * pricing.output;
  const costUsd = inputCostUsd + outputCostUsd;

  // Convert to NGN
  const costNgn = costUsd * ngnToUsdRate;

  return {
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000, // Round to 6 decimal places
    costNgn: Math.round(costNgn * 100) / 100, // Round to 2 decimal places
    tokensUsed: usage.totalTokens,
  };
}

/**
 * Estimate token count for text (rough approximation)
 * Uses average of 4 characters per token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for HuggingFace/Ollama (estimated)
 * Since these don't provide exact token counts, we estimate
 */
export function calculateEstimatedCost(
  text: string,
  model: string = 'huggingface',
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const estimatedTokens = estimateTokens(text);

  // HuggingFace inference is typically free or very low cost
  // Ollama is self-hosted, so cost is $0 (infrastructure cost not included)
  const costUsd = 0; // Free/self-hosted
  const costNgn = 0;

  return {
    costUsd,
    costNgn,
    tokensUsed: estimatedTokens,
  };
}





