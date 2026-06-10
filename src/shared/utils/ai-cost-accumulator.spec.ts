import { AiCostAccumulator } from './ai-cost-accumulator';

describe('AiCostAccumulator', () => {
  it('aggregates multiple usage types', () => {
    const acc = new AiCostAccumulator(1500);

    acc.addChat({
      operation: 'chat',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200 },
    });

    acc.addEmbedding({
      provider: 'openai',
      model: 'text-embedding-3-small',
      promptTokens: 500,
      totalTokens: 500,
    });

    const totals = acc.getTotals();
    expect(totals.tokensUsed).toBe(1700);
    expect(totals.costUsd).toBeGreaterThan(0);
    expect(acc.getBreakdown()).toHaveLength(2);
  });

  it('merges another accumulator', () => {
    const a = new AiCostAccumulator();
    const b = new AiCostAccumulator();

    a.addImage({
      provider: 'openai',
      model: 'gpt-image-1',
      imageCount: 2,
      size: '1024x1024',
      quality: 'medium',
    });

    b.addChat({
      operation: 'extraction',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    a.merge(b);
    expect(a.getBreakdown()).toHaveLength(2);
    expect(a.getTotals().costUsd).toBeGreaterThan(0);
  });
});
