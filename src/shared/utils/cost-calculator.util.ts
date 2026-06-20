/**
 * Cost calculator utility for AI model usage.
 * Pricing last verified: June 2026 — https://openai.com/api/pricing/
 */

// Chat model pricing per 1M tokens (input/output)
const CHAT_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

// Embedding pricing per 1M input tokens
const EMBEDDING_MODEL_PRICING: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.1,
};

// gpt-image-1 per-image pricing (1024x1024)
const IMAGE_PRICING: Record<
  string,
  Record<string, Record<'low' | 'medium' | 'high', number>>
> = {
  'gpt-image-1': {
    '1024x1024': { low: 0.011, medium: 0.042, high: 0.167 },
    '1024x1536': { low: 0.016, medium: 0.063, high: 0.25 },
    '1536x1024': { low: 0.016, medium: 0.063, high: 0.25 },
  },
};

const WHISPER_COST_PER_MINUTE = 0.006;
const TTS_COST_PER_MILLION_CHARS = 15.0;

export const DEFAULT_NGN_TO_USD_RATE = 1500;

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

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundNgn(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNgn(costUsd: number, ngnToUsdRate: number): number {
  return roundNgn(costUsd * ngnToUsdRate);
}

function resolveChatPricing(model: string): { input: number; output: number } {
  const key = model.toLowerCase();
  if (CHAT_MODEL_PRICING[key]) {
    return CHAT_MODEL_PRICING[key];
  }
  // gpt-4.1-mini-2025-04-14 style dated aliases
  if (key.startsWith('gpt-4.1-mini')) return CHAT_MODEL_PRICING['gpt-4.1-mini'];
  if (key.startsWith('gpt-4.1')) return CHAT_MODEL_PRICING['gpt-4.1'];
  if (key.startsWith('gpt-4o-mini')) return CHAT_MODEL_PRICING['gpt-4o-mini'];
  if (key.startsWith('gpt-4o')) return CHAT_MODEL_PRICING['gpt-4o'];
  console.warn(`Unknown chat model ${model}, using gpt-4o-mini pricing`);
  return CHAT_MODEL_PRICING['gpt-4o-mini'];
}

/**
 * Calculate chat/extraction cost based on token usage and model.
 */
export function calculateChatCost(
  model: string,
  usage: TokenUsage,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const pricing = resolveChatPricing(model);
  const inputCostUsd = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (usage.completionTokens / 1_000_000) * pricing.output;
  const costUsd = roundUsd(inputCostUsd + outputCostUsd);

  return {
    costUsd,
    costNgn: toNgn(costUsd, ngnToUsdRate),
    tokensUsed: usage.totalTokens,
  };
}

/** @deprecated Use calculateChatCost — kept for backward compatibility */
export function calculateCost(
  model: string,
  usage: TokenUsage,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  return calculateChatCost(model, usage, ngnToUsdRate);
}

export function calculateEmbeddingCost(
  model: string,
  promptTokens: number,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const key = model.toLowerCase();
  const pricePerMillion =
    EMBEDDING_MODEL_PRICING[key] ??
    EMBEDDING_MODEL_PRICING['text-embedding-3-small'];
  const costUsd = roundUsd((promptTokens / 1_000_000) * pricePerMillion);

  return {
    costUsd,
    costNgn: toNgn(costUsd, ngnToUsdRate),
    tokensUsed: promptTokens,
  };
}

export function calculateImageCost(
  model: string,
  imageCount: number,
  size: string = '1024x1024',
  quality: 'low' | 'medium' | 'high' = 'medium',
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const modelKey = model.toLowerCase();
  const modelPricing = IMAGE_PRICING[modelKey] ?? IMAGE_PRICING['gpt-image-1'];
  const sizePricing = modelPricing[size] ?? modelPricing['1024x1024'];
  const perImage = sizePricing[quality] ?? sizePricing.medium;
  const costUsd = roundUsd(perImage * imageCount);

  return {
    costUsd,
    costNgn: toNgn(costUsd, ngnToUsdRate),
    tokensUsed: 0,
  };
}

export function calculateWhisperCost(
  durationSeconds: number,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const minutes = durationSeconds / 60;
  const costUsd = roundUsd(minutes * WHISPER_COST_PER_MINUTE);

  return {
    costUsd,
    costNgn: toNgn(costUsd, ngnToUsdRate),
    tokensUsed: 0,
  };
}

export function calculateTtsCost(
  charCount: number,
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const costUsd = roundUsd(
    (charCount / 1_000_000) * TTS_COST_PER_MILLION_CHARS,
  );

  return {
    costUsd,
    costNgn: toNgn(costUsd, ngnToUsdRate),
    tokensUsed: 0,
  };
}

/**
 * Estimate token count for text (rough approximation: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate audio duration from buffer size (MP3 ~16KB/s at 128kbps).
 */
export function estimateAudioDurationSeconds(bufferSizeBytes: number): number {
  if (!bufferSizeBytes) return 0;
  return Math.max(1, Math.ceil(bufferSizeBytes / 16_000));
}

/**
 * Calculate cost for HuggingFace/Ollama fallbacks (infrastructure cost not included).
 */
export function calculateEstimatedCost(
  text: string,
  _model: string = 'huggingface',
  ngnToUsdRate: number = DEFAULT_NGN_TO_USD_RATE,
): CostCalculation {
  const estimatedTokens = estimateTokens(text);

  return {
    costUsd: 0,
    costNgn: 0,
    tokensUsed: estimatedTokens,
  };
}
