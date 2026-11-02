import { describe, it, expect } from 'vitest';
import { parseProviderError } from '../src/agent/openai';

describe('parseProviderError', () => {
  it('sayısal code değerini metne çevirir (tt.includes is not a function hatası)', () => {
    const r = parseProviderError('{"error":{"code":401,"message":"Invalid key"}}');
    expect(r.code).toBe('401');
    expect(() => r.code.includes('ACCOUNT_')).not.toThrow();
  });
  it('null code ve nesne message için çökmez', () => {
    const r = parseProviderError('{"error":{"code":null,"message":{"detail":"x"}}}');
    expect(r.code).toBe('');
    expect(typeof r.message).toBe('string');
    expect(() => r.message.toLowerCase().includes('promo')).not.toThrow();
  });
  it('error alanı düz metinse onu kullanır', () => {
    expect(parseProviderError('{"error":"rate limited"}').message).toBe('rate limited');
  });
  it('JSON olmayan gövdeyi olduğu gibi döner', () => {
    expect(parseProviderError('<html>502</html>')).toEqual({ message: '<html>502</html>', code: '' });
  });
});
