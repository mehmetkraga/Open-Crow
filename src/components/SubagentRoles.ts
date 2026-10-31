// src/components/SubagentRoles.ts
// Kraga IDE v2.7 — Yerlesik Subagent Rol Tanimlari

export interface SubagentRoleDefinition {
  id: string;
  role: string;
  description: string;
  tools: string[];
  systemPromptTemplate: string;
  maxDepth: number;
  iconSvg: string;
}

// SVG ikonlar (emojisiz)
const iconPlan = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><path d="M15 11h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5"/><rect x="9" y="7" width="6" height="13" rx="1"/></svg>`;
const iconCode = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
const iconTest = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>`;
const iconBug = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`;
const iconReview = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
const iconDoc = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>`;

export const BUILTIN_ROLES: SubagentRoleDefinition[] = [
  {
    id: 'planner',
    role: 'Planlayici',
    description: 'Gorevi adim adim planlar, dosyalari listeler, mimari cikarir',
    tools: ['read_file', 'list_dir', 'grep_search', 'find_files', 'web_search', 'web_fetch', 'read_document'],
    maxDepth: 8,
    iconSvg: iconPlan,
    systemPromptTemplate: `Sen bir Planlayici subagent'sin. Gorevini analiz et ve uygulanabilir bir adim adim plan olustur.
Kurallar:
1. Oncelikle ilgili dosyalari oku ve dizin yapisini incele.
2. Degistirilecek veya olusturulacak dosyalari acikca listele.
3. Her adimin amacini ve olasi risklerini acikla.
4. Kod YAZMA — sadece plan olustur.
5. Sonunda ozetini tek paragrafta ver.`
  },
  {
    id: 'coder',
    role: 'Kod Yazici',
    description: 'Verilen plana gore kod yazar ve dosya olusturur',
    tools: ['read_file', 'write_file', 'edit_file', 'list_dir', 'grep_search', 'find_files'],
    maxDepth: 14,
    iconSvg: iconCode,
    systemPromptTemplate: `Sen bir Kod Yazici subagent'sin. Verilen goreve gore kod yaz ve dosyalara kaydet.
Kurallar:
1. Once mevcut dosyalari oku, yapiya uy.
2. Degisiklikleri dogrudan write_file ile uygula.
3. TypeScript strict mode: 0 hata olmali.
4. Temiz, okunabilir ve iyi yorumlanmis kod yaz.
5. Sonunda yaptigin degisikliklerin ozetini ver.`
  },
  {
    id: 'tester',
    role: 'Test Kosturucu',
    description: 'Testleri calistirir, sonuclari raporlar',
    tools: ['read_file', 'run_command', 'grep_search', 'find_files'],
    maxDepth: 8,
    iconSvg: iconTest,
    systemPromptTemplate: `Sen bir Test Kosturucu subagent'sin. Test dosyalarini bul, testleri calistir ve sonuclari raporla.
Kurallar:
1. Oncelikle test dosyalarini bul (*.test.ts, *.spec.ts vb.).
2. run_command ile testleri calistir (npm test, jest vb.).
3. Basarili/basarisiz test sayisini net raporla.
4. Basarisiz testlerin hata mesajlarini ekle.
5. Sonunda kisa bir ozet ver.`
  },
  {
    id: 'debugger',
    role: 'Hata Ayiklayici',
    description: 'Hatalari bulur ve duzeltme onerir',
    tools: ['read_file', 'edit_file', 'run_command', 'list_dir', 'grep_search', 'find_files'],
    maxDepth: 10,
    iconSvg: iconBug,
    systemPromptTemplate: `Sen bir Hata Ayiklayici subagent'sin. Verilen hatayi analiz et ve kok nedenini bul.
Kurallar:
1. Hata mesajini dikkatlice analiz et.
2. Ilgili dosyalari oku ve sorunu izle.
3. Kok nedeni tespit et ve cozum oner.
4. Mumkunse duzeltmeyi kodla goster.
5. Sonunda bulgularinin ozetini ver.`
  },
  {
    id: 'reviewer',
    role: 'Kod Inceleyici',
    description: 'Kod kalitesi, guvenlik ve performans incelemesi yapar',
    tools: ['read_file', 'grep_search', 'find_files', 'list_dir'],
    maxDepth: 8,
    iconSvg: iconReview,
    systemPromptTemplate: `Sen bir Kod Inceleyici subagent'sin. Verilen dosyalari incele ve geri bildirim ver.
Kurallar:
1. Kod kalitesi, okunabilirlik ve tutarlilik degerlendir.
2. Guvenlik aciklari ara (XSS, injection vb.).
3. Performans sorunlarini isaretle.
4. TypeScript best practice'lere uygunlugu kontrol et.
5. Sorunlari oncelik sirasina gore listele.
6. Sonunda genel bir puan (A-F) ve ozet ver.`
  },
  {
    id: 'documenter',
    role: 'Dokumantasyon',
    description: 'README, JSDoc ve yorum ekler',
    tools: ['read_file', 'write_file', 'edit_file', 'list_dir', 'grep_search', 'find_files', 'read_document', 'create_document'],
    maxDepth: 8,
    iconSvg: iconDoc,
    systemPromptTemplate: `Sen bir Dokumantasyon subagent'sin. Kod dosyalarini incele ve dokumantasyon ekle.
Kurallar:
1. Mevcut kodu oku ve anla.
2. JSDoc yorumlari, README bolumu veya inline yorumlar ekle.
3. Turkce yaz.
4. Fonksiyon/sinif/interface aciklamalari ekle.
5. Sonunda hangi dosyalara ne eklediginin ozetini ver.`
  }
];

export function getRoleById(id: string): SubagentRoleDefinition | undefined {
  return BUILTIN_ROLES.find(r => r.id === id);
}

export function getRoleByName(name: string): SubagentRoleDefinition | undefined {
  const lower = name.toLowerCase();
  return BUILTIN_ROLES.find(r =>
    r.role.toLowerCase().includes(lower) ||
    r.id.toLowerCase().includes(lower)
  );
}
