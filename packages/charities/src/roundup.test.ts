import { describe, expect, it } from 'vitest';
import { formatJarProgress, jarContribution, thresholdState } from './roundup';

describe('jarContribution', () => {
  it.each([
    [9.34, 66],
    [9.99, 1],
    [10.0, 0],
    [10.5, 50],
    [0.01, 99],
    [1234.56, 44],
    [3.4, 60], // ceil(3.40) - 3.40 = 0.60
  ])('contributes correct cents for $%s', (price, expected) => {
    expect(jarContribution(price)).toBe(expected);
  });

  it('returns 0 for non-positive amounts', () => {
    expect(jarContribution(0)).toBe(0);
    expect(jarContribution(-5)).toBe(0);
  });

  it('returns 0 for non-finite input', () => {
    expect(jarContribution(Number.NaN)).toBe(0);
    expect(jarContribution(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('handles values that are exact integer dollars in cents', () => {
    expect(jarContribution(100)).toBe(0);
    expect(jarContribution(1)).toBe(0);
  });

  it('compensates for floating-point fuzz at the cents boundary', () => {
    // 0.1 + 0.2 is famously 0.30000000000000004 — would mis-round if
    // we used Math.ceil directly.
    expect(jarContribution(0.1 + 0.2)).toBe(70);
  });
});

describe('thresholdState', () => {
  it('reports not-reached when jar is below threshold', () => {
    expect(thresholdState(999, 1000)).toEqual({
      reachedThreshold: false,
      thresholdAmountUsd: 10,
      remainderAfter: 0,
    });
  });

  it('reports reached at exact threshold with no remainder', () => {
    expect(thresholdState(1000, 1000)).toEqual({
      reachedThreshold: true,
      thresholdAmountUsd: 10,
      remainderAfter: 0,
    });
  });

  it('carries remainder when jar exceeds threshold', () => {
    expect(thresholdState(1031, 1000)).toEqual({
      reachedThreshold: true,
      thresholdAmountUsd: 10,
      remainderAfter: 31,
    });
  });

  it('handles larger thresholds', () => {
    expect(thresholdState(5050, 5000)).toEqual({
      reachedThreshold: true,
      thresholdAmountUsd: 50,
      remainderAfter: 50,
    });
  });

  it('clamps negative jar to 0', () => {
    expect(thresholdState(-100, 1000).remainderAfter).toBe(0);
    expect(thresholdState(-100, 1000).reachedThreshold).toBe(false);
  });

  it('floors fractional jar/threshold inputs', () => {
    expect(thresholdState(999.9, 1000)).toEqual({
      reachedThreshold: false,
      thresholdAmountUsd: 10,
      remainderAfter: 0,
    });
  });
});

describe('formatJarProgress', () => {
  it('renders dollars + cents to two decimals', () => {
    expect(formatJarProgress(131, 1000)).toBe('$1.31 / $10.00');
    expect(formatJarProgress(0, 2000)).toBe('$0.00 / $20.00');
  });

  it('caps the visible jar at the threshold', () => {
    expect(formatJarProgress(1500, 1000)).toBe('$10.00 / $10.00');
  });

  it('clamps negative jar to $0.00', () => {
    expect(formatJarProgress(-50, 1000)).toBe('$0.00 / $10.00');
  });
});
