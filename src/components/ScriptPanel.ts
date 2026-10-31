// src/components/ScriptPanel.ts
// Open Crow — Visual Studio Tarzı Proje Script & Görev Yöneticisi (Tasks / Scripts Runner)

import { iconTerminal, iconRefresh, iconPlay, iconCheck, iconAlertCircle } from './icons';

export interface ScriptItem {
  name: string;
  command: string;
  category?: 'build' | 'dev' | 'test' | 'dist' | 'custom';
}

export class ScriptPanelManager {
  private container: HTMLElement;
  private currentProjectPath: string | null = null;
  private scripts: ScriptItem[] = [];
  public onRunCommand?: (command: string) => void;
  public onClose?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setProjectPath(projectPath: string | null): void {
    this.currentProjectPath = projectPath;
    this.loadScripts();
  }

  public async loadScripts(): Promise<void> {
    this.scripts = [];

    if (this.currentProjectPath && window.kragaAPI?.fs?.readFile) {
      try {
        const pkgPath = `${this.currentProjectPath.replace(/\\/g, '/')}/package.json`;
        const content = await window.kragaAPI.fs.readFile(pkgPath);
        if (content) {
          const pkg = JSON.parse(content);
          if (pkg.scripts && typeof pkg.scripts === 'object') {
            for (const [name, cmd] of Object.entries(pkg.scripts)) {
              let category: ScriptItem['category'] = 'custom';
              if (name.includes('build')) category = 'build';
              else if (name.includes('dev') || name.includes('start')) category = 'dev';
              else if (name.includes('test')) category = 'test';
              else if (name.includes('dist') || name.includes('pack')) category = 'dist';

              this.scripts.push({
                name,
                command: String(cmd),
                category,
              });
            }
          }
        }
      } catch (err) {
        console.warn('package.json scriptleri okunamadı:', err);
      }
    }

    this.render();
  }

  public render(): void {
    const hasProject = !!this.currentProjectPath;
    const hasScripts = this.scripts.length > 0;

    this.container.innerHTML = `
      <div class="script-panel-container">
        <!-- Header -->
        <div class="script-panel-header">
          <div class="script-panel-header__left">
            <div class="script-panel-icon-wrap">
              ${iconTerminal(22, 'var(--accent-color, #00f0ff)')}
            </div>
            <div>
              <h2 class="script-panel-title">Proje Scriptleri & Görev Paneli</h2>
              <p class="script-panel-subtitle">
                Visual Studio tarzı yerleşik görev yöneticisi. package.json scriptlerini ve terminal görevlerini tek tıkla koşturun.
              </p>
            </div>
          </div>
          <div class="script-panel-header__actions">
            <button class="script-panel-btn" id="btnRefreshScripts" title="Scriptleri Yenile">
              ${iconRefresh(14)} Yenile
            </button>
          </div>
        </div>

        <!-- Custom Command Quick Runner Bar -->
        <div class="script-quick-runner">
          <span class="script-quick-runner__prompt">$</span>
          <input 
            type="text" 
            id="scriptQuickInput" 
            class="script-quick-runner__input" 
            placeholder="Özel terminal komutu çalıştır (örn: npm run lint, git status, npx vitest)..." 
          />
          <button class="script-quick-runner__btn" id="btnRunQuickCommand">
            ${iconPlay(14)} Çalıştır
          </button>
        </div>

        <!-- Body / Scripts List -->
        <div class="script-panel-body">
          ${!hasProject ? `
            <div class="script-panel-empty">
              ${iconAlertCircle(36, 'var(--text-muted)')}
              <h3>Henüz Bir Proje Klasörü Açılmadı</h3>
              <p>Scriptleri görüntülemek ve çalıştırmak için lütfen sol menüden veya Hoş Geldiniz sekmesinden bir proje klasörü açın.</p>
            </div>
          ` : !hasScripts ? `
            <div class="script-panel-empty">
              ${iconAlertCircle(36, 'var(--text-muted)')}
              <h3>package.json veya Script Bulunamadı</h3>
              <p>Açık projede tanımlı bir package.json script'i bulunamadı. Yukarıdaki hızlı komut kutusunu kullanarak dilediğiniz terminal komutunu koşturabilirsiniz.</p>
            </div>
          ` : `
            <div class="script-grid">
              ${this.scripts.map((script) => `
                <div class="script-card" data-script="${script.name}">
                  <div class="script-card__header">
                    <div class="script-card__name-wrap">
                      <span class="script-badge script-badge--${script.category || 'custom'}">npm</span>
                      <span class="script-card__name">${script.name}</span>
                    </div>
                    <button class="script-card__run-btn" data-run-name="${script.name}">
                      ${iconPlay(12)} Çalıştır
                    </button>
                  </div>
                  <div class="script-card__command">
                    <code>${script.command}</code>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Event Listener'ları bağla
    this.container.querySelector('#btnRefreshScripts')?.addEventListener('click', () => {
      this.loadScripts();
    });

    const quickInput = this.container.querySelector('#scriptQuickInput') as HTMLInputElement;
    const btnQuickRun = this.container.querySelector('#btnRunQuickCommand') as HTMLButtonElement;

    const executeQuick = () => {
      const cmd = quickInput?.value.trim();
      if (cmd && this.onRunCommand) {
        this.onRunCommand(cmd);
        quickInput.value = '';
      }
    };

    btnQuickRun?.addEventListener('click', executeQuick);
    quickInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeQuick();
    });

    this.container.querySelectorAll('[data-run-name]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const scriptName = (e.currentTarget as HTMLElement).getAttribute('data-run-name');
        if (scriptName && this.onRunCommand) {
          this.onRunCommand(`npm run ${scriptName}`);
          
          const origText = btn.innerHTML;
          btn.innerHTML = `${iconCheck(12)} Başlatıldı`;
          btn.classList.add('script-card__run-btn--success');
          setTimeout(() => {
            btn.innerHTML = origText;
            btn.classList.remove('script-card__run-btn--success');
          }, 1800);
        }
      });
    });
  }
}
