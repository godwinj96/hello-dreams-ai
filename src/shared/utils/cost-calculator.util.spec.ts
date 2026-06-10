import {
  calculateChatCost,
  calculateEmbeddingCost,
  calculateImageCost,
  calculateWhisperCost,
  estimateAudioDurationSeconds,
} from './cost-calculator.util';

describe('cost-calculator.util', () => {
  it('calculates gpt-4.1-mini chat cost', () => {
    const result = calculateChatCost('gpt-4.1-mini', {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });
    expect(result.tokensUsed).toBe(1500);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('calculates embedding cost', () => {
    const result = calculateEmbeddingCost('text-embedding-3-small', 10_000);
    expect(result.costUsd).toBe(0.0002);
    expect(result.tokensUsed).toBe(10_000);
  });

  it('calculates image cost per unit', () => {
    const result = calculateImageCost('gpt-image-1', 4, '1024x1024', 'medium');
    expect(result.costUsd).toBe(0.168);
    expect(result.tokensUsed).toBe(0);
  });

  it('calculates whisper cost from duration', () => {
    const result = calculateWhisperCost(60);
    expect(result.costUsd).toBe(0.006);
  });

  it('estimates audio duration from buffer size', () => {
    expect(estimateAudioDurationSeconds(32_000)).toBe(2);
  });
});
