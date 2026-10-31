// src/components/ThemeManager.ts
// Kraga IDE 7 Tema Yöneticisi (Monaco ve xterm Senkronizasyonu, Logo Değişimi, Emojisiz)

export interface ThemeDefinition {
  id: string;
  name: string;
  logo: string;
  titleLogo: string;
  className: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: 'original-dark', name: 'Orijinal (Siyah, Varsayılan)', logo: './assets/images/logo-bird-original.png', titleLogo: './assets/images/logo-kraga-ide-original.png', className: 'theme-original-dark' },
  { id: 'kraga-cyberpunk', name: 'Klasik (Neon)', logo: './assets/images/logo-bird.png', titleLogo: './assets/images/logo-kraga-ide-neon.png', className: 'theme-kraga-dark' },
  { id: 'dracula', name: 'Mor', logo: './assets/images/logo-bird-dracula.png', titleLogo: './assets/images/logo-kraga-ide-dracula.png', className: 'theme-dracula' },
  { id: 'emerald-dark', name: 'Yeşil', logo: './assets/images/logo-bird-emerald-dark.png', titleLogo: './assets/images/logo-kraga-ide-emerald.png', className: 'theme-emerald-dark' },
  { id: 'midnight-blue', name: 'Mavi', logo: './assets/images/logo-bird-midnight-blue.png', titleLogo: './assets/images/logo-kraga-ide-midnight-blue.png', className: 'theme-midnight-blue' },
  { id: 'sunset-warm', name: 'Turuncu', logo: './assets/images/logo-bird-sunset-warm.png', titleLogo: './assets/images/logo-kraga-ide-sunset.png', className: 'theme-sunset-warm' },
  { id: 'synthwave', name: 'Pembe', logo: './assets/images/logo-bird-synthwave.png', titleLogo: './assets/images/logo-kraga-ide-synthwave.png', className: 'theme-synthwave' },
  { id: 'minimal-light', name: 'Açık', logo: './assets/images/logo-bird-minimal-light.png', titleLogo: './assets/images/logo-kraga-ide-minimal-light.png', className: 'theme-minimal-light' },
  { id: 'vs-2022-dark', name: 'Visual Studio Koyu', logo: './assets/images/logo-bird-original.png', titleLogo: './assets/images/logo-kraga-ide-original.png', className: 'theme-vs-dark' },
];

export class ThemeManager {
  private currentThemeId: string;
  private logoImgEl: HTMLImageElement | null;
  private titleLogoImgEl: HTMLImageElement | null;
  public onThemeChange?: (themeId: string) => void;

  constructor(logoImgId = 'brandLogoImg', selectorId = 'themeSelector', titleLogoImgId = 'brandTitleLogoImg') {
    this.logoImgEl = document.getElementById(logoImgId) as HTMLImageElement;
    this.titleLogoImgEl = document.getElementById(titleLogoImgId) as HTMLImageElement;
    // Varsayılan artık Orijinal (siyah-beyaz). Neon varsayılanıyla kalmış mevcut kullanıcılar bir kez Orijinal'e alınır.
    let saved = localStorage.getItem('kraga_ide_theme');
    if (saved === 'kraga-cyberpunk' && !localStorage.getItem('kraga_ide_theme_v2')) saved = 'original-dark';
    localStorage.setItem('kraga_ide_theme_v2', '1');
    this.currentThemeId = saved || 'original-dark';

    this.applyTheme(this.currentThemeId);
    this.bindSelector(selectorId);
  }

  public applyTheme(themeId: string): void {
    const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    this.currentThemeId = theme.id;
    localStorage.setItem('kraga_ide_theme', theme.id);

    // Body sınıflarını temizle ve yeni tema sınıfını ekle
    THEMES.forEach((t) => document.body.classList.remove(t.className));
    document.body.classList.add(theme.className);
    document.body.setAttribute('data-theme', theme.id);

    // Başlık çubuğundaki logonun görselini temaya uygun kuş ikonuyla güncelle
    if (this.logoImgEl) {
      this.logoImgEl.src = theme.logo;
      this.logoImgEl.alt = theme.name;
    }

    // Başlık çubuğundaki KRAGA IDE neon yazı logosunu temaya göre güncelle
    if (this.titleLogoImgEl) {
      this.titleLogoImgEl.src = theme.titleLogo;
      this.titleLogoImgEl.alt = `${theme.name} Open Crow`;
    }

    // Hoş Geldiniz ekranındaki logoyu temaya uygun neon yazıyla güncelle
    const welcomeLogo = document.getElementById('welcomeLogoImg') as HTMLImageElement;
    if (welcomeLogo) {
      welcomeLogo.src = theme.titleLogo;
      welcomeLogo.alt = `${theme.name} Open Crow`;
    }

    // Seçiciyi senkronize et
    const selector = document.getElementById('themeSelector') as HTMLSelectElement;
    if (selector && selector.value !== theme.id) {
      selector.value = theme.id;
    }

    // Monaco & xterm dinleyicilerini tetikle
    if (this.onThemeChange) {
      this.onThemeChange(theme.id);
    }

    // Global tema değişim olayını yayınla
    window.dispatchEvent(new CustomEvent('kraga:theme-change', {
      detail: { themeId: theme.id, theme }
    }));
  }

  private bindSelector(selectorId: string): void {
    const selector = document.getElementById(selectorId) as HTMLSelectElement;
    if (!selector) return;

    selector.innerHTML = '';
    for (const theme of THEMES) {
      const opt = document.createElement('option');
      opt.value = theme.id;
      opt.textContent = theme.name;
      opt.selected = theme.id === this.currentThemeId;
      selector.appendChild(opt);
    }

    selector.addEventListener('change', () => {
      this.applyTheme(selector.value);
    });
  }

  public getCurrentTheme(): ThemeDefinition {
    return THEMES.find((t) => t.id === this.currentThemeId) || THEMES[0];
  }
}
