import { describe, expect, it } from 'vitest';

import { holdingInputSchema, holdingPatchSchema, symbolSchema } from '@/src/lib/validators';

describe('symbolSchema', () => {
  it('uppercases lowercase symbols', () => {
    expect(symbolSchema.parse('aapl')).toBe('AAPL');
  });

  it('trims surrounding whitespace before upper-casing', () => {
    expect(symbolSchema.parse('  msft  ')).toBe('MSFT');
  });

  it('accepts mixed case and normalizes it', () => {
    expect(symbolSchema.parse('GoOg')).toBe('GOOG');
  });

  it('accepts digits, dots, and dashes (BRK.B, RDS-A, 700.HK)', () => {
    expect(symbolSchema.parse('BRK.B')).toBe('BRK.B');
    expect(symbolSchema.parse('RDS-A')).toBe('RDS-A');
    expect(symbolSchema.parse('700.HK')).toBe('700.HK');
  });

  it('accepts a 1-char symbol', () => {
    expect(symbolSchema.parse('F')).toBe('F');
  });

  it('accepts the max length of 10', () => {
    expect(symbolSchema.parse('abcdefghij')).toBe('ABCDEFGHIJ');
  });

  it('rejects empty string', () => {
    expect(() => symbolSchema.parse('')).toThrow();
  });

  it('rejects a whitespace-only string', () => {
    expect(() => symbolSchema.parse('   ')).toThrow();
  });

  it('rejects symbols longer than 10 chars', () => {
    expect(() => symbolSchema.parse('ABCDEFGHIJK')).toThrow();
  });

  it('rejects symbols with invalid characters', () => {
    expect(() => symbolSchema.parse('AA PL')).toThrow();
    expect(() => symbolSchema.parse('AA$PL')).toThrow();
    expect(() => symbolSchema.parse('AA/PL')).toThrow();
    expect(() => symbolSchema.parse('AA_PL')).toThrow();
  });

  it('rejects non-string inputs', () => {
    expect(() => symbolSchema.parse(123)).toThrow();
    expect(() => symbolSchema.parse(null)).toThrow();
    expect(() => symbolSchema.parse(undefined)).toThrow();
  });
});

describe('holdingInputSchema', () => {
  it('accepts a valid holding with numeric fields', () => {
    const result = holdingInputSchema.parse({
      symbol: 'aapl',
      shares: 10,
      averageCost: 150.25,
    });
    expect(result).toEqual({ symbol: 'AAPL', shares: 10, averageCost: 150.25 });
  });

  it('coerces string shares/averageCost to numbers', () => {
    const result = holdingInputSchema.parse({
      symbol: 'MSFT',
      shares: '5.5',
      averageCost: '100.10',
    });
    expect(result).toEqual({ symbol: 'MSFT', shares: 5.5, averageCost: 100.1 });
  });

  it('accepts averageCost of 0 (free shares / gift)', () => {
    const result = holdingInputSchema.parse({ symbol: 'AAPL', shares: 1, averageCost: 0 });
    expect(result.averageCost).toBe(0);
  });

  it('rejects zero shares (must be positive)', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: 0, averageCost: 100 }),
    ).toThrow();
  });

  it('rejects negative shares', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: -1, averageCost: 100 }),
    ).toThrow();
  });

  it('rejects negative averageCost', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: 1, averageCost: -0.01 }),
    ).toThrow();
  });

  it('rejects shares above the max', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: 1_000_000_001, averageCost: 1 }),
    ).toThrow();
  });

  it('rejects averageCost above the max', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: 1, averageCost: 1_000_001 }),
    ).toThrow();
  });

  it('rejects an invalid symbol', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'BAD SYM', shares: 1, averageCost: 1 }),
    ).toThrow();
  });

  it('rejects a missing required field', () => {
    expect(() => holdingInputSchema.parse({ symbol: 'AAPL', shares: 1 })).toThrow();
  });

  it('rejects a non-numeric string for shares', () => {
    expect(() =>
      holdingInputSchema.parse({ symbol: 'AAPL', shares: 'abc', averageCost: 1 }),
    ).toThrow();
  });
});

describe('holdingPatchSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(holdingPatchSchema.parse({})).toEqual({});
  });

  it('accepts shares only', () => {
    expect(holdingPatchSchema.parse({ shares: 2 })).toEqual({ shares: 2 });
  });

  it('accepts averageCost only', () => {
    expect(holdingPatchSchema.parse({ averageCost: 10 })).toEqual({ averageCost: 10 });
  });

  it('coerces string numerics', () => {
    expect(holdingPatchSchema.parse({ shares: '3', averageCost: '9.5' })).toEqual({
      shares: 3,
      averageCost: 9.5,
    });
  });

  it('rejects non-positive shares when provided', () => {
    expect(() => holdingPatchSchema.parse({ shares: 0 })).toThrow();
    expect(() => holdingPatchSchema.parse({ shares: -1 })).toThrow();
  });

  it('rejects negative averageCost when provided', () => {
    expect(() => holdingPatchSchema.parse({ averageCost: -0.1 })).toThrow();
  });
});
