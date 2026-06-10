import { readRawNumber } from './raw-query.util';

describe('readRawNumber', () => {
  it('reads camelCase alias', () => {
    expect(readRawNumber({ totalCostUsd: '1.5' }, 'totalCostUsd')).toBe(1.5);
  });

  it('reads lowercase alias from PostgreSQL driver', () => {
    expect(readRawNumber({ totalcostusd: '2.25' }, 'totalCostUsd')).toBe(2.25);
  });

  it('returns 0 for missing row or key', () => {
    expect(readRawNumber(undefined, 'totalCostUsd')).toBe(0);
    expect(readRawNumber({}, 'totalCostUsd')).toBe(0);
  });
});
