import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

describe('Update version comparison', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (global as any).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('correctly evaluates semver version comparisons for in-app updates', () => {
    const isNewer = (latest: string, current: string): boolean => {
      const cleanL = latest.replace(/^v/i, '').trim();
      const cleanC = current.replace(/^v/i, '').trim();
      const partsL = cleanL.split('.').map(n => parseInt(n, 10) || 0);
      const partsC = cleanC.split('.').map(n => parseInt(n, 10) || 0);
      const len = Math.max(partsL.length, partsC.length);
      for (let i = 0; i < len; i++) {
        const vL = partsL[i] || 0;
        const vC = partsC[i] || 0;
        if (vL > vC) return true;
        if (vL < vC) return false;
      }
      return false;
    };

    expect(isNewer('1.8.8', '1.8.7')).toBe(true);
    expect(isNewer('v1.8.8', '1.8.7')).toBe(true);
    expect(isNewer('1.8.8', '1.8.6')).toBe(true);
    expect(isNewer('1.8.7', '1.8.7')).toBe(false);
    expect(isNewer('1.8.6', '1.8.8')).toBe(false);
    expect(isNewer('1.8.8', '1.8.8')).toBe(false);
    expect(isNewer('1.9.0', '1.8.8')).toBe(true);
    expect(isNewer('2.0.0', '1.8.8')).toBe(true);
  });
});
