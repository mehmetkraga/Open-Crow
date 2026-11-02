import { describe, it, expect } from 'vitest';
import { parseRule, ruleMatches, evaluateRules, rulesFromSettings, allowRuleFor, globToRegExp } from '../src/agent/permissions';
import { loadInstructions, renderInstructions, parseSkill, parseSlashCommand, matchCommands } from '../src/agent/instructions';
import { changesInTurn, summarizeTurn, undoTurn, lastTurn, turnIndexOf } from '../src/agent/checkpoints';
import type { ChatMessage } from '../src/core/ChatHistory';

describe('izin kuralları', () => {
  it('kural metnini ayrıştırır', () => {
    expect(parseRule('Bash(npm test)', 'allow')).toEqual({ behavior: 'allow', tool: 'Bash', specifier: 'npm test' });
    expect(parseRule('Read', 'deny')).toEqual({ behavior: 'deny', tool: 'Read', specifier: undefined });
    expect(parseRule('', 'allow')).toBeNull();
  });

  it('Bash kalıbı joker ile eşleşir ve büyük/küçük harfe duyarsızdır', () => {
    const rule = parseRule('Bash(npm run *)', 'allow')!;
    expect(ruleMatches(rule, 'Bash', { command: 'npm run build' })).toBe(true);
    expect(ruleMatches(rule, 'Bash', { command: 'NPM RUN lint' })).toBe(true);
    expect(ruleMatches(rule, 'Bash', { command: 'npm install' })).toBe(false);
  });

  it('dosya kalıbı yol ayırıcısını normalize eder', () => {
    const rule = parseRule('Edit(src/*.ts)', 'deny')!;
    expect(ruleMatches(rule, 'Edit', { path: 'src\\a.ts' })).toBe(true);
    expect(ruleMatches(rule, 'Edit', { path: 'src/deep/a.ts' })).toBe(false);
  });

  it('WebFetch domain kuralı alt alanları da kapsar', () => {
    const rule = parseRule('WebFetch(domain:example.com)', 'allow')!;
    expect(ruleMatches(rule, 'WebFetch', { url: 'https://docs.example.com/x' })).toBe(true);
    expect(ruleMatches(rule, 'WebFetch', { url: 'https://evilexample.com/x' })).toBe(false);
  });

  it('değerlendirme sırası: deny > ask > allow', () => {
    const rules = [parseRule('Bash', 'allow')!, parseRule('Bash(rm *)', 'deny')!, parseRule('Bash(git *)', 'ask')!];
    expect(evaluateRules(rules, 'Bash', { command: 'rm -rf x' })).toBe('deny');
    expect(evaluateRules(rules, 'Bash', { command: 'git push' })).toBe('ask');
    expect(evaluateRules(rules, 'Bash', { command: 'npm test' })).toBe('allow');
    expect(evaluateRules([], 'Bash', { command: 'npm test' })).toBeNull();
  });

  it('ayar dosyasındaki permissions bloğunu okur, bozuk girdiyi atlar', () => {
    const rules = rulesFromSettings({ permissions: { allow: ['Bash(npm test)', 42], deny: ['Read(.env)'], ask: 'yanlış' } });
    expect(rules.map((r) => r.behavior)).toEqual(['allow', 'deny']);
    expect(rulesFromSettings(null)).toEqual([]);
  });

  it('"hep izin ver" seçimi kalıp üretir', () => {
    expect(allowRuleFor('Bash', { command: ' npm test ' })).toEqual({ behavior: 'allow', tool: 'Bash', specifier: 'npm test' });
    expect(allowRuleFor('Read', { path: 'a' })).toBeNull();
    expect(globToRegExp('a*b').test('axxb')).toBe(true);
  });
});

describe('proje talimatları ve beceriler', () => {
  it('mevcut talimat dosyalarını sırayla yükler, eksikleri atlar', async () => {
    const files: Record<string, string> = { 'CLAUDE.md': '  Türkçe yaz.  ', 'AGENTS.md': '' };
    const loaded = await loadInstructions(async (p) => files[p] ?? null);
    expect(loaded).toEqual([{ file: 'CLAUDE.md', content: 'Türkçe yaz.' }]);
    expect(renderInstructions(loaded)).toContain('### CLAUDE.md');
    expect(renderInstructions([])).toBe('');
  });

  it('SKILL.md frontmatter ve gövdeyi ayırır', () => {
    const skill = parseSkill('---\nname: ozet\ndescription: "Kısa özet çıkarır"\n---\n# Başlık\nGövde', 'fallback');
    expect(skill).toEqual({ name: 'ozet', description: 'Kısa özet çıkarır', body: '# Başlık\nGövde' });
    expect(parseSkill('# Test kontrolü\nAdımlar', 'testler').name).toBe('testler');
  });

  it('slash komutunu ayrıştırır ve eşleştirir', () => {
    expect(parseSlashCommand('/model gpt-5 x')).toEqual({ name: 'model', args: 'gpt-5 x' });
    expect(parseSlashCommand('/yardım')).toBeNull();
    expect(parseSlashCommand('dosya /yol')).toBeNull();
    const commands = [
      { name: 'model', description: 'Model seç' },
      { name: 'mode', description: 'Mod' },
      { name: 'clear', description: 'Temizle' },
    ];
    expect(matchCommands('mo', commands).map((c) => c.name)).toEqual(['model', 'mode']);
    expect(matchCommands('', commands)).toHaveLength(3);
  });
});

function msgs(): ChatMessage[] {
  const base = { timestamp: 0, id: '' };
  return [
    { ...base, role: 'user', content: 'ilk' },
    { ...base, role: 'assistant', content: '' },
    { ...base, role: 'tool', content: 'ok', checkpoint: { path: 'a.ts', before: 'eski' } },
    { ...base, role: 'tool', content: 'ok', checkpoint: { path: 'a.ts', before: 'ara' } },
    { ...base, role: 'user', content: 'ikinci' },
    { ...base, role: 'tool', content: 'ok', checkpoint: { path: 'yeni.ts', before: null } },
  ];
}

describe('denetim noktaları', () => {
  it('tur numaralarını hesaplar', () => {
    expect(turnIndexOf(msgs(), 2)).toBe(1);
    expect(turnIndexOf(msgs(), 5)).toBe(2);
    expect(lastTurn(msgs())).toBe(2);
  });

  it('bir turdaki değişiklikleri özetler; aynı dosyanın ilk içeriği esas alınır', () => {
    expect(changesInTurn(msgs(), 1).get('a.ts')?.before).toBe('eski');
    expect(summarizeTurn(msgs(), 2)).toEqual([{ path: 'yeni.ts', kind: 'created' }]);
  });

  it('geri alma önceki içeriği yazar ve yeni dosyayı siler', async () => {
    const writes: Record<string, string> = {};
    const removed: string[] = [];
    const restored = await undoTurn(msgs(), 1, {
      write: async (p, c) => void (writes[p] = c),
      remove: async (p) => void removed.push(p),
    });
    expect(writes).toEqual({ 'a.ts': 'eski' });
    expect(removed).toEqual([]);
    expect(restored).toEqual([{ path: 'a.ts', kind: 'modified' }]);

    await undoTurn(msgs(), 2, {
      write: async () => {},
      remove: async (p) => void removed.push(p),
    });
    expect(removed).toEqual(['yeni.ts']);
  });
});
