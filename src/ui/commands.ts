// src/ui/commands.ts
// Yerleşik slash komutlarının tanımları. Çalıştırma mantığı main.ts'dedir; burada yalnızca ad ve açıklama vardır.

export interface CommandDef {
  name: string;
  description: string;
  /** Argüman bekleyen komutlar paletten seçildiğinde doğrudan çalışmaz, metne eklenir */
  argHint?: string;
  kind: 'builtin' | 'skill';
}

export const BUILTIN_COMMANDS: CommandDef[] = [
  { name: 'yeni', description: 'Yeni sohbet başlat', kind: 'builtin' },
  { name: 'model', description: 'Modeli değiştir', argHint: '<model adı>', kind: 'builtin' },
  { name: 'mod', description: 'Onay modunu değiştir (plan, ask, edits, auto)', argHint: '[mod]', kind: 'builtin' },
  { name: 'stil', description: 'Yanıt stilini seç', argHint: '[normal|concise|explanatory]', kind: 'builtin' },
  { name: 'klasor', description: 'Çalışma klasörünü seç', kind: 'builtin' },
  { name: 'init', description: 'Proje için OPENCROW.md oluşturmasını iste', kind: 'builtin' },
  { name: 'bellek', description: 'Yüklü talimat dosyalarını ve izin kurallarını göster', kind: 'builtin' },
  { name: 'beceriler', description: 'Kullanılabilir becerileri listele', kind: 'builtin' },
  { name: 'ozet', description: 'Uzun sohbeti özetleyip bağlamı küçült', kind: 'builtin' },
  { name: 'degisiklikler', description: 'Son turda değişen dosyaları göster', kind: 'builtin' },
  { name: 'geri-al', description: 'Son turdaki dosya değişikliklerini geri al', kind: 'builtin' },
  { name: 'kopyala', description: 'Son asistan yanıtını panoya kopyala', kind: 'builtin' },
  { name: 'aktar', description: 'Sohbetin tamamını Markdown olarak panoya kopyala', kind: 'builtin' },
  { name: 'yardim', description: 'Klavye kısayollarını göster', kind: 'builtin' },
];

/** Yerleşik komutlar ve çalışma klasöründeki beceriler, tek listede. */
export function allCommands(skills: { name: string; description: string }[]): CommandDef[] {
  const skillCommands: CommandDef[] = skills.map((skill) => ({
    name: skill.name,
    description: skill.description || 'Beceri',
    argHint: '[istek]',
    kind: 'skill',
  }));
  return [...BUILTIN_COMMANDS, ...skillCommands];
}

export const SHORTCUTS_HELP =
  'Shift+Tab: onay modunu değiştir · Ctrl+N: yeni sohbet · Esc: yanıtı durdur · Enter: gönder (meşgulken sıraya ekler) · Shift+Enter: yeni satır · /: komut paleti';
