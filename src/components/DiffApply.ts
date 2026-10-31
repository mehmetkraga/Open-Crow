// src/components/DiffApply.ts
// Kraga AI Kod Blokları Yönetimi (Editörde Açma, Dosyaya Kaydetme & Diff Uygulama)

import { iconCopy, iconFileEdit, iconFilePlus, iconCheck, iconClose, iconExternalLink, iconFolder } from './icons';
import { DiffModalManager } from './DiffModal';

export interface CodeBlock {
  language: string;
  code: string;
  index: number;
}

export class DiffApplyManager {
  private diffModal = new DiffModalManager();
  public onOpenInEditor: (code: string, language: string) => Promise<void> = async () => {};
  public onApplyToFile: (filePath: string, code: string) => Promise<void> = async () => {};
  public onCreateFile: (filePath: string, code: string) => Promise<void> = async () => {};
  public onGetOpenFiles: () => { path: string; name: string }[] = () => [];
  public onGetWorkspacePath: () => string = () => '';

  public parseCodeBlocks(html: string): CodeBlock[] {
    const div = document.createElement('div');
    div.innerHTML = html;
    const blocks: CodeBlock[] = [];
    const preElements = div.querySelectorAll('pre');

    preElements.forEach((pre, index) => {
      const codeEl = pre.querySelector('code');
      const code = codeEl?.textContent || pre.textContent || '';
      let language = '';

      if (codeEl) {
        const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/);
        if (match) {
          language = match[1];
        }
      }

      blocks.push({
        language,
        code,
        index,
      });
    });
    return blocks;
  }

  public enhanceCodeBlocks(messageElement: HTMLElement): void {
    const preElements = messageElement.querySelectorAll('pre');

    preElements.forEach((pre) => {
      if (pre.querySelector('.code-block-actions')) {
        return;
      }

      // Plan ve artifact konteynerlerindeki pre bloklarına KESİNLİKLE DiffApply butonları ekleme!
      if (pre.closest('.plan-artifact-widget, .plan-streaming-card, .plan-artifact-card, .plan-workspace, .plan-detail-modal, #planWorkspaceView, #planWorkspaceMarkdownBody')) {
        return;
      }

      const codeEl = pre.querySelector('code');
      const code = codeEl?.textContent || pre.textContent || '';
      let language = '';

      if (codeEl) {
        const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/);
        if (match) {
          language = match[1];
        }
      }

      const cleanLang = (language || '').toLowerCase().trim();

      // Plan, şema veya doküman içeriği tespiti
      const isPlanLike =
        code.includes('flowchart TD') ||
        code.includes('graph TD') ||
        code.includes('Implementation Plan') ||
        code.includes('Uygulama Planı') ||
        code.includes('Veri Modeli') ||
        code.includes('Dosya Yapısı') ||
        code.includes('[NEW]') ||
        code.includes('[MODIFY]') ||
        /(?:^|\n)\s*\|\s*[^|]+\s*\|\s*[^|]+\s*\|/.test(code);

      const recognizedCodeLangs = new Set([
        'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'sass', 'less',
        'python', 'py', 'json', 'sql', 'c', 'cpp', 'csharp', 'cs', 'java', 'rust', 'rs', 'go', 'php', 'ruby', 'rb',
        'swift', 'kotlin', 'kt', 'yaml', 'yml', 'xml', 'dockerfile', 'graphql'
      ]);

      const isRealCode = recognizedCodeLangs.has(cleanLang) && !isPlanLike;

      // Eğer plan benzeri bir bloksa hiçbir buton ekleme (sohbeti kirletmesin)
      if (isPlanLike) {
        return;
      }

      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'code-block-actions';

      // 1. Kopyala Butonu
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-block-actions__btn code-block-actions__btn--copy';
      copyBtn.innerHTML = `${iconCopy(13)} Kopyala`;
      copyBtn.title = 'Kodu panoya kopyala';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          copyBtn.innerHTML = `${iconCheck(13)} Kopyalandı`;
          setTimeout(() => {
            copyBtn.innerHTML = `${iconCopy(13)} Kopyala`;
          }, 2000);
        } catch (err) {
          console.error('Kopyalama başarısız:', err);
        }
      });
      actionsContainer.appendChild(copyBtn);

      // 2. Visual Studio Tarzı: Editörde Aç (Yeni Sekme) - Kodlar veya Markdown için
      if (isRealCode || cleanLang === 'markdown' || cleanLang === 'md') {
        const openInEditorBtn = document.createElement('button');
        openInEditorBtn.className = 'code-block-actions__btn code-block-actions__btn--open';
        openInEditorBtn.innerHTML = `${iconExternalLink(13)} Editörde Aç`;
        openInEditorBtn.title = 'İçeriği doğrudan yeni bir editör sekmesinde aç';
        openInEditorBtn.addEventListener('click', async () => {
          await this.onOpenInEditor(code, language);
        });
        actionsContainer.appendChild(openInEditorBtn);
      }

      // Sadece gerçek programlama dillerinde Dosyaya Kaydet ve Dosyaya Uygula butonları ekle
      if (isRealCode) {
        // 3. Dosyaya Kaydet (Konum Sorarak Yeni Dosya)
        const saveFileBtn = document.createElement('button');
        saveFileBtn.className = 'code-block-actions__btn code-block-actions__btn--new-file';
        saveFileBtn.innerHTML = `${iconFilePlus(13)} Dosyaya Kaydet`;
        saveFileBtn.title = 'Dosya konumu ve adı belirterek diske kaydet';
        saveFileBtn.addEventListener('click', () => {
          this.showSaveNewFileModal(code, language);
        });

        // 4. Mevcut Dosyaya Uygula (Diff / Replace)
        const applyBtn = document.createElement('button');
        applyBtn.className = 'code-block-actions__btn code-block-actions__btn--apply';
        applyBtn.innerHTML = `${iconFileEdit(13)} Dosyaya Uygula`;
        applyBtn.title = 'Açık dosyalardan birinin üzerine yaz';
        applyBtn.addEventListener('click', () => {
          this.showApplyModal(code);
        });

        // 5. Visual Studio 2022 Görsel Diff (Yan Yana Karşılaştır)
        const diffBtn = document.createElement('button');
        diffBtn.className = 'code-block-actions__btn code-block-actions__btn--diff';
        diffBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg> Görsel Diff`;
        diffBtn.title = 'Visual Studio 2022 tarzı yan yana görsel diff ile karşılaştır';
        diffBtn.addEventListener('click', () => {
          this.showVisualDiffModal(code, cleanLang);
        });

        actionsContainer.appendChild(saveFileBtn);
        actionsContainer.appendChild(applyBtn);
        actionsContainer.appendChild(diffBtn);
      }

      pre.appendChild(actionsContainer);
    });
  }

  // Visual Studio tarzı konum ve dosya adı soran modal
  public showSaveNewFileModal(code: string, language: string): void {
    const workspacePath = this.onGetWorkspacePath() || '';
    const suggestedName = this.getSuggestedFileName(language);

    const overlay = document.createElement('div');
    overlay.className = 'diff-preview-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';

    const modal = document.createElement('div');
    modal.className = 'diff-preview modal-save-file';
    modal.style.backgroundColor = 'var(--bg-panel, #0f101d)';
    modal.style.color = 'var(--text-primary, #f1f5f9)';
    modal.style.padding = '22px 26px';
    modal.style.borderRadius = '12px';
    modal.style.border = '1px solid var(--border-color, #232742)';
    modal.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.7)';
    modal.style.width = '480px';
    modal.style.maxWidth = '90vw';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '16px';

    modal.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: var(--accent-color, #00f0ff);">
          ${iconFilePlus(18)} Dosyayı Kaydet & Editörde Aç
        </h3>
        <button id="modalSaveCloseBtn" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 4px;">
          ${iconClose(16)}
        </button>
      </div>

      <div style="font-size: 12px; color: var(--text-secondary, #94a3b8); line-height: 1.5;">
        ${workspacePath ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color, #232742);">
            ${iconFolder(14)}
            <span style="font-family: var(--font-mono); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${workspacePath}</span>
          </div>
        ` : ''}
        Oluşturulacak dosya adını veya göreceli yolunu belirtin:
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <input 
          id="modalSavePathInput" 
          type="text" 
          value="${suggestedName}" 
          placeholder="örn: index.html veya src/components/App.tsx"
          style="padding: 10px 14px; background: var(--bg-main, #07070e); color: var(--text-primary, #fff); border: 1px solid var(--border-color, #232742); border-radius: 8px; font-family: var(--font-mono); font-size: 13px; outline: none;"
        />
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
        <button id="modalSaveCancelBtn" class="code-block-actions__btn" style="padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          ${iconClose(14)} İptal
        </button>
        <button id="modalSaveConfirmBtn" class="code-block-actions__btn code-block-actions__btn--open" style="padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ${iconCheck(14)} Kaydet & Aç
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#modalSavePathInput') as HTMLInputElement;
    const confirmBtn = modal.querySelector('#modalSaveConfirmBtn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#modalSaveCancelBtn') as HTMLButtonElement;
    const closeBtn = modal.querySelector('#modalSaveCloseBtn') as HTMLButtonElement;

    input.focus();
    input.select();

    const closeModal = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    };

    const handleSave = async () => {
      const fileName = input.value.trim();
      if (!fileName) return;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = 'Kaydediliyor...';

      let targetFullPath = fileName;
      if (workspacePath && !fileName.includes(':') && !fileName.startsWith('/') && !fileName.startsWith('\\')) {
        const sep = workspacePath.includes('/') ? '/' : '\\';
        targetFullPath = `${workspacePath.replace(/[/\\]+$/, '')}${sep}${fileName.replace(/^[/\\]+/, '')}`;
      }

      try {
        await this.onCreateFile(targetFullPath, code);
        closeModal();
      } catch (err: any) {
        alert(`Dosya kaydedilemedi: ${err.message || err}`);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `${iconCheck(14)} Kaydet & Aç`;
      }
    };

    confirmBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });
  }

  private showApplyModal(code: string): void {
    const openFiles = this.onGetOpenFiles();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'diff-preview-overlay';
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100vw';
    modalOverlay.style.height = '100vh';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modalOverlay.style.backdropFilter = 'blur(4px)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.zIndex = '99999';

    const modal = document.createElement('div');
    modal.className = 'diff-preview';
    modal.style.backgroundColor = 'var(--bg-panel, #0f101d)';
    modal.style.color = 'var(--text-primary, #ffffff)';
    modal.style.padding = '24px';
    modal.style.borderRadius = '12px';
    modal.style.border = '1px solid var(--border-color, #232742)';
    modal.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.7)';
    modal.style.minWidth = '420px';
    modal.style.maxWidth = '90vw';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '16px';

    const title = document.createElement('h3');
    title.textContent = 'Dosyaya Uygula';
    title.style.margin = '0';
    title.style.fontSize = '15px';
    title.style.fontWeight = '700';
    title.style.color = 'var(--accent-color, #00f0ff)';
    modal.appendChild(title);

    const selectContainer = document.createElement('div');
    selectContainer.style.display = 'flex';
    selectContainer.style.flexDirection = 'column';
    selectContainer.style.gap = '8px';

    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Hedef Açık Dosya:';
    selectLabel.style.fontSize = '12px';
    selectLabel.style.color = 'var(--text-secondary, #94a3b8)';
    selectContainer.appendChild(selectLabel);

    const select = document.createElement('select');
    select.style.padding = '10px 12px';
    select.style.backgroundColor = 'var(--bg-main, #07070e)';
    select.style.color = 'var(--text-primary, #ffffff)';
    select.style.border = '1px solid var(--border-color, #232742)';
    select.style.borderRadius = '6px';
    select.style.fontFamily = 'var(--font-mono)';
    select.style.fontSize = '12px';
    select.style.outline = 'none';

    if (openFiles.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Açık dosya bulunamadı';
      select.appendChild(option);
      select.disabled = true;
    } else {
      openFiles.forEach((file) => {
        const option = document.createElement('option');
        option.value = file.path;
        option.textContent = `${file.name} (${file.path})`;
        select.appendChild(option);
      });
    }
    selectContainer.appendChild(select);
    modal.appendChild(selectContainer);

    const warningMsg = document.createElement('div');
    warningMsg.innerHTML = '<strong>Uyarı:</strong> Seçilen dosyanın içeriği tamamen bu kodla güncellenecektir.';
    warningMsg.style.color = 'var(--status-yellow, #ffc107)';
    warningMsg.style.fontSize = '12px';
    warningMsg.style.lineHeight = '1.4';
    warningMsg.style.padding = '8px 12px';
    warningMsg.style.background = 'rgba(255, 193, 7, 0.08)';
    warningMsg.style.borderRadius = '6px';
    warningMsg.style.border = '1px solid rgba(255, 193, 7, 0.2)';
    modal.appendChild(warningMsg);

    const actions = document.createElement('div');
    actions.className = 'diff-preview__actions';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '10px';
    actions.style.marginTop = '4px';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'code-block-actions__btn';
    cancelBtn.innerHTML = `${iconClose(14)} İptal`;
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'code-block-actions__btn code-block-actions__btn--apply';
    confirmBtn.innerHTML = `${iconCheck(14)} Uygula`;
    confirmBtn.style.padding = '8px 18px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = '600';
    confirmBtn.disabled = openFiles.length === 0;
    if (openFiles.length === 0) {
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
    }

    const inspectDiffBtn = document.createElement('button');
    inspectDiffBtn.className = 'code-block-actions__btn code-block-actions__btn--diff';
    inspectDiffBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg> Yan Yana Diff İncele`;
    inspectDiffBtn.style.padding = '8px 14px';
    inspectDiffBtn.style.cursor = 'pointer';
    inspectDiffBtn.disabled = openFiles.length === 0;
    if (openFiles.length === 0) {
      inspectDiffBtn.style.opacity = '0.5';
      inspectDiffBtn.style.cursor = 'not-allowed';
    }

    inspectDiffBtn.addEventListener('click', async () => {
      const targetPath = select.value;
      if (targetPath) {
        document.body.removeChild(modalOverlay);
        await this.launchDiffForFile(targetPath, code);
      }
    });

    confirmBtn.addEventListener('click', async () => {
      const targetPath = select.value;
      if (targetPath) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = 'Uygulanıyor...';
        await this.onApplyToFile(targetPath, code);
        document.body.removeChild(modalOverlay);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(inspectDiffBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);

    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
  }

  public async launchDiffForFile(targetPath: string, modifiedCode: string, lang?: string): Promise<void> {
    let originalCode = '';
    try {
      const res = await (window as any).kragaAPI?.fs?.readFile(targetPath);
      originalCode = (res && typeof res.content === 'string') ? res.content : '';
    } catch (e) {
      console.error('Diff için dosya içeriği okunamadı:', e);
    }

    const fileName = targetPath.split(/[/\\]/).pop() || 'Dosya';
    this.diffModal.open({
      filePath: targetPath,
      fileName,
      originalCode,
      modifiedCode,
      language: lang,
      onApply: async (newCode) => {
        await this.onApplyToFile(targetPath, newCode);
      }
    });
  }

  public showVisualDiffModal(code: string, language?: string): void {
    const openFiles = this.onGetOpenFiles();
    if (openFiles.length === 1) {
      this.launchDiffForFile(openFiles[0].path, code, language);
      return;
    }
    this.showApplyModal(code);
  }

  private getSuggestedFileName(lang: string): string {
    const l = (lang || '').toLowerCase();
    if (l === 'html') return 'index.html';
    if (l === 'css') return 'style.css';
    if (l === 'javascript' || l === 'js') return 'main.js';
    if (l === 'typescript' || l === 'ts') return 'main.ts';
    if (l === 'python' || l === 'py') return 'app.py';
    if (l === 'json') return 'data.json';
    if (l === 'markdown' || l === 'md') return 'README.md';
    if (l === 'sql') return 'schema.sql';
    return `untitled.${l || 'txt'}`;
  }
}
