import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  (globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
  (globalThis as any).document = {};
});

describe('triggerMatches', () => {
  it('kısa tetikleyiciler yalnızca tam sözcük olarak eşleşir', async () => {
    const { triggerMatches } = await import('../src/components/SkillsHub');
    expect(triggerMatches('bugün hava nasıl', 'bug')).toBe(false);
    expect(triggerMatches('random sayı üret', 'dom')).toBe(false);
    expect(triggerMatches('bu bug nedir', 'bug')).toBe(true);
    expect(triggerMatches('dom güncellemesi', 'dom')).toBe(true);
  });
  it('uzun tetikleyiciler Türkçe/İngilizce ekleri kabul eder', async () => {
    const { triggerMatches } = await import('../src/components/SkillsHub');
    expect(triggerMatches('bu hatayı düzelt', 'hata')).toBe(true);
    expect(triggerMatches('refactoring yapalım', 'refactor')).toBe(true);
    expect(triggerMatches('prerefactor', 'refactor')).toBe(false);
  });
  it('özel karakterli tetikleyicilerde çökmez', async () => {
    const { triggerMatches } = await import('../src/components/SkillsHub');
    expect(() => triggerMatches('c++ yaz', 'c++')).not.toThrow();
    expect(triggerMatches('(x', '(')).toBeTypeOf('boolean');
  });
});

describe('SkillsHubManager', () => {
  it('alakasız cümle hiçbir yeteneği tetiklemez', async () => {
    const { SkillsHubManager } = await import('../src/components/SkillsHub');
    const m = new SkillsHubManager();
    const hits = m.getMatchingSkillsForText('bugün hava nasıl').filter((s) => !s.enabled);
    expect(hits).toHaveLength(0);
  });
  it('gerçek bir tetikleyici ilgili yeteneği getirir ve enjeksiyon üretir', async () => {
    const { SkillsHubManager } = await import('../src/components/SkillsHub');
    const m = new SkillsHubManager();
    const hits = m.getMatchingSkillsForText('bu kodu refactor et').filter((s) => !s.enabled);
    expect(hits.length).toBeGreaterThan(0);
    const inj = m.getSystemPromptInjections('bu kodu refactor et');
    expect(inj).toContain('[YETENEK:');
    expect(inj.length).toBeLessThan(12000);
  });
  it('enjeksiyon en fazla 3 yetenekle sınırlıdır', async () => {
    const { SkillsHubManager } = await import('../src/components/SkillsHub');
    const m = new SkillsHubManager();
    for (const s of m.getSkills().slice(0, 6)) m.enableSkill(s.id);
    const inj = m.getSystemPromptInjections();
    expect((inj.match(/\[YETENEK:/g) || []).length).toBe(3);
  });
  it('yerleşik yetenekler silinemez, özel olanlar silinir', async () => {
    const { SkillsHubManager } = await import('../src/components/SkillsHub');
    const m = new SkillsHubManager();
    const before = m.getSkills().length;
    m.deleteSkill(m.getSkills()[0].id);
    expect(m.getSkills().length).toBe(before);
    const c = m.addCustomSkill('Benim Yeteneğim', 'açıklama', 'sistem istemi', 'coding');
    expect(m.getSkills().length).toBe(before + 1);
    m.deleteSkill(c.id);
    expect(m.getSkills().length).toBe(before);
  });
  it('uydurma popülerlik (yıldız) alanı kalmamıştır', async () => {
    const { BUILTIN_SKILLS } = await import('../src/components/SkillsHub');
    expect(BUILTIN_SKILLS.some((s) => s.stars)).toBe(false);
  });
  it('durum kalıcıdır', async () => {
    const { SkillsHubManager } = await import('../src/components/SkillsHub');
    const a = new SkillsHubManager();
    const id = a.getSkills()[5].id;
    a.enableSkill(id);
    const b = new SkillsHubManager();
    expect(b.getActiveSkills().some((s) => s.id === id)).toBe(true);
  });
});
