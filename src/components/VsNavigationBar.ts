// src/components/VsNavigationBar.ts
// Open Crow — Visual Studio 2022 Sınıf ve Üye Gezinti Çubuğu (Class & Member Navigation Bar)
// Editörün üstünde yer alan ve aktif dosyadaki sınıfları/tipleri ve metotları/fonksiyonları dinamik listeleyen bar

export interface VsSymbol {
  name: string;
  kind: 'class' | 'interface' | 'namespace' | 'method' | 'function' | 'property' | 'enum' | 'struct';
  line: number;
  endLine?: number;
  containerName?: string;
}

export class VsNavigationBar {
  private container: HTMLElement;
  private leftSelectEl: HTMLSelectElement | null = null;
  private rightSelectEl: HTMLSelectElement | null = null;

  private typeSymbols: VsSymbol[] = [];
  private memberSymbols: VsSymbol[] = [];
  private symbolCache = new Map<string, { hash: string; typeSymbols: VsSymbol[]; memberSymbols: VsSymbol[] }>();

  public onNavigateToLine?: (line: number) => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
  }

  public setVisible(visible: boolean): void {
    if (!this.container) return;
    if (visible) {
      this.container.classList.add('is-visible');
    } else {
      this.container.classList.remove('is-visible');
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.classList.add('vs-nav-bar-container', 'vs-nav-bar');
    this.container.innerHTML = `
      <div class="vs-nav-bar-inner">
        <!-- Sol Açılır Kutu: Proje / Tür / Sınıf / Namespace -->
        <div class="vs-nav-item vs-nav-item--type">
          <span class="vs-nav-kind-icon vs-nav-kind-icon--type" title="Tür / Sınıf">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
          </span>
          <select class="vs-nav-select" id="vsNavTypeSelect" title="Sınıf / Tür Seç">
            <option value="0">Dosya</option>
          </select>
          <span class="vs-nav-chevron">▾</span>
        </div>

        <div class="vs-nav-divider"></div>

        <!-- Sağ Açılır Kutu: Üye / Metot / Fonksiyon / Özellik -->
        <div class="vs-nav-item vs-nav-item--member">
          <span class="vs-nav-kind-icon vs-nav-kind-icon--member" title="Üye / Metot">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </span>
          <select class="vs-nav-select" id="vsNavMemberSelect" title="Metot / Üye Seç">
            <option value="0">Genel Kod</option>
          </select>
          <span class="vs-nav-chevron">▾</span>
        </div>
      </div>
    `;

    this.leftSelectEl = this.container.querySelector('#vsNavTypeSelect');
    this.rightSelectEl = this.container.querySelector('#vsNavMemberSelect');

    this.leftSelectEl?.addEventListener('change', () => {
      const line = parseInt(this.leftSelectEl?.value || '0', 10);
      if (line > 0) {
        this.onNavigateToLine?.(line);
      }
    });

    this.rightSelectEl?.addEventListener('change', () => {
      const line = parseInt(this.rightSelectEl?.value || '0', 10);
      if (line > 0) {
        this.onNavigateToLine?.(line);
      }
    });
  }

  /**
   * Aktif dosyanın içeriğini ve dilini analiz ederek sembolleri çıkarır
   */
  public updateFileSymbols(code: string, filePath: string): void {
    const hash = `${code.length}_${code.slice(0, 30)}_${code.slice(-30)}`;
    const cached = this.symbolCache.get(filePath);
    if (cached && cached.hash === hash) {
      this.typeSymbols = cached.typeSymbols;
      this.memberSymbols = cached.memberSymbols;
      if (this.typeSymbols.length === 0 && this.memberSymbols.length === 0) {
        this.setVisible(false);
        return;
      }
      this.setVisible(true);
      this.populateDropdowns(filePath);
      return;
    }

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const lines = code.split('\n');
    const symbols: VsSymbol[] = [];

    // 1. C# Dosyaları (.cs)
    if (ext === 'cs') {
      this.extractCSharpSymbols(lines, symbols);
    }
    // 2. TypeScript / JavaScript (.ts, .tsx, .js, .jsx)
    else if (['ts', 'tsx', 'js', 'jsx', 'mjs'].includes(ext)) {
      this.extractJsTsSymbols(lines, symbols);
    }
    // 3. Python (.py)
    else if (ext === 'py') {
      this.extractPythonSymbols(lines, symbols);
    }
    // 4. Diğer dosyalar
    else {
      this.extractGenericSymbols(lines, symbols);
    }

    this.typeSymbols = symbols.filter(s => ['class', 'interface', 'namespace', 'struct', 'enum'].includes(s.kind));
    this.memberSymbols = symbols.filter(s => ['method', 'function', 'property'].includes(s.kind));

    this.symbolCache.set(filePath, { hash, typeSymbols: this.typeSymbols, memberSymbols: this.memberSymbols });
    if (this.typeSymbols.length === 0 && this.memberSymbols.length === 0) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    this.populateDropdowns(filePath);
  }

  private extractCSharpSymbols(lines: string[], symbols: VsSymbol[]): void {
    let currentContainer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Namespace
      const nsMatch = line.match(/^namespace\s+([a-zA-Z0-9_.]+)/);
      if (nsMatch) {
        currentContainer = nsMatch[1];
        symbols.push({ name: nsMatch[1], kind: 'namespace', line: lineNum });
        continue;
      }

      // Class / Struct / Interface
      const classMatch = line.match(/(?:public|private|protected|internal|static)?\s*(?:partial)?\s*(class|struct|interface|enum)\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        const kind = classMatch[1] as any;
        const name = classMatch[2];
        currentContainer = name;
        symbols.push({ name, kind, line: lineNum });
        continue;
      }

      // Method (C# tarzı: [Attributes], void / Type MethodName(...))
      const methodMatch = line.match(/(?:public|private|protected|internal|static|virtual|override|async)?\s+([a-zA-Z0-9_<>?[\]]+)\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:where\s+.*)?(?:\{|=>|$)/);
      if (methodMatch && !line.startsWith('if') && !line.startsWith('while') && !line.startsWith('for') && !line.startsWith('return') && !line.startsWith('new') && !line.startsWith('var')) {
        const methodName = methodMatch[2];
        if (methodName && methodName !== 'class' && methodName !== 'struct' && methodName !== 'using') {
          symbols.push({
            name: `${methodName}()`,
            kind: 'method',
            line: lineNum,
            containerName: currentContainer,
          });
        }
      }
    }
  }

  private extractJsTsSymbols(lines: string[], symbols: VsSymbol[]): void {
    let currentContainer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Class / Interface / Type
      const classMatch = line.match(/(?:export\s+)?(?:default\s+)?(class|interface|type|enum)\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        const kind = classMatch[1] as any;
        const name = classMatch[2];
        currentContainer = name;
        symbols.push({ name, kind, line: lineNum });
        continue;
      }

      // Function declaration
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
      if (funcMatch) {
        symbols.push({
          name: `${funcMatch[1]}()`,
          kind: 'function',
          line: lineNum,
          containerName: currentContainer,
        });
        continue;
      }

      // Arrow function / Const method
      const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        symbols.push({
          name: `${arrowMatch[1]}()`,
          kind: 'function',
          line: lineNum,
          containerName: currentContainer,
        });
        continue;
      }

      // Class method
      const classMethodMatch = line.match(/(?:public|private|protected|static|async)?\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
      if (classMethodMatch && !line.startsWith('if') && !line.startsWith('for') && !line.startsWith('switch') && !line.startsWith('catch') && !line.startsWith('while')) {
        const name = classMethodMatch[1];
        if (name && name !== 'constructor' && name !== 'function' && name !== 'return' && name !== 'import') {
          symbols.push({
            name: `${name}()`,
            kind: 'method',
            line: lineNum,
            containerName: currentContainer,
          });
        } else if (name === 'constructor') {
          symbols.push({
            name: 'constructor()',
            kind: 'method',
            line: lineNum,
            containerName: currentContainer,
          });
        }
      }
    }
  }

  private extractPythonSymbols(lines: string[], symbols: VsSymbol[]): void {
    let currentContainer = '';

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      const lineNum = i + 1;

      // Class
      const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        currentContainer = classMatch[1];
        symbols.push({ name: classMatch[1], kind: 'class', line: lineNum });
        continue;
      }

      // Def (method or function)
      const defMatch = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (defMatch) {
        const isIndented = rawLine.startsWith('    ') || rawLine.startsWith('\t');
        symbols.push({
          name: `${defMatch[1]}()`,
          kind: isIndented ? 'method' : 'function',
          line: lineNum,
          containerName: isIndented ? currentContainer : undefined,
        });
      }
    }
  }

  private extractGenericSymbols(lines: string[], symbols: VsSymbol[]): void {
    // HTML / Markdown / Diğerleri için başlıklar ve bölümler
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      if (line.startsWith('# ')) {
        symbols.push({ name: line.slice(2), kind: 'namespace', line: lineNum });
      } else if (line.startsWith('## ')) {
        symbols.push({ name: line.slice(3), kind: 'method', line: lineNum });
      }
    }
  }

  private populateDropdowns(filePath: string): void {
    if (!this.leftSelectEl || !this.rightSelectEl) return;

    const fileName = filePath.split(/[\\/]/).pop() || 'Untitled';

    // Sol Açılır Kutu (Sınıflar / Tipler)
    this.leftSelectEl.innerHTML = '';
    if (this.typeSymbols.length === 0) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = `📄 ${fileName}`;
      this.leftSelectEl.appendChild(opt);
    } else {
      for (const sym of this.typeSymbols) {
        const opt = document.createElement('option');
        opt.value = sym.line.toString();
        const prefix = sym.kind === 'interface' ? '◇ ' : sym.kind === 'enum' ? '◈ ' : '◆ ';
        opt.textContent = `${prefix}${sym.name}`;
        this.leftSelectEl.appendChild(opt);
      }
    }

    // Sağ Açılır Kutu (Metotlar / Fonksiyonlar)
    this.rightSelectEl.innerHTML = '';
    if (this.memberSymbols.length === 0) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = '⚡ Genel Kod';
      this.rightSelectEl.appendChild(opt);
    } else {
      for (const sym of this.memberSymbols) {
        const opt = document.createElement('option');
        opt.value = sym.line.toString();
        const containerPrefix = sym.containerName ? `${sym.containerName}.` : '';
        opt.textContent = `ƒ ${containerPrefix}${sym.name} (L${sym.line})`;
        this.rightSelectEl.appendChild(opt);
      }
    }
  }

  /**
   * İmleç pozisyonu değiştikçe açılır kutulardaki seçili elemanı anlık günceller
   */
  public onCursorChange(line: number): void {
    if (this.typeSymbols.length > 0 && this.leftSelectEl) {
      let activeType: VsSymbol | null = null;
      for (const sym of this.typeSymbols) {
        if (sym.line <= line) {
          activeType = sym;
        } else {
          break;
        }
      }
      if (activeType && this.leftSelectEl.value !== activeType.line.toString()) {
        this.leftSelectEl.value = activeType.line.toString();
      }
    }

    if (this.memberSymbols.length > 0 && this.rightSelectEl) {
      let activeMember: VsSymbol | null = null;
      for (const sym of this.memberSymbols) {
        if (sym.line <= line) {
          activeMember = sym;
        } else {
          break;
        }
      }
      if (activeMember && this.rightSelectEl.value !== activeMember.line.toString()) {
        this.rightSelectEl.value = activeMember.line.toString();
      }
    }
  }
}
