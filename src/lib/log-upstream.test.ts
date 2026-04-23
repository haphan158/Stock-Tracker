import { describe, expect, it } from 'vitest';

import { isLikelyUpstreamRateLimitBody, upstreamErrorLogFields } from '@/src/lib/log-upstream';

describe('log-upstream', () => {
  it('detects Yahoo 429 + JSON parse noise', () => {
    const e = new SyntaxError(`Unexpected token 'T', "Too Many Requests\r\n" is not valid JSON`);
    expect(isLikelyUpstreamRateLimitBody(e)).toBe(true);
    expect(upstreamErrorLogFields(e).rateLimited).toBe(true);
    expect(upstreamErrorLogFields(e).err).toBeUndefined();
  });

  it('passes through other errors', () => {
    const e = new Error('network reset');
    expect(isLikelyUpstreamRateLimitBody(e)).toBe(false);
    expect(upstreamErrorLogFields(e).err).toBe(e);
  });
});
