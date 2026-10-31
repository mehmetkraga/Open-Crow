// src/components/CodeDiagnosticsEngine.ts
// Kraga IDE v2.5 — Visual Studio Düzeyinde Canlı Çoklu Dil Kod Teşhis & Hata Motoru (Linter & Diagnostics)
// HTML, JavaScript/TypeScript, CSS, JSON ve Python dosyalarında gerçek zamanlı sözdizimi,
// eşleşmeyen parantez/etiket, eksik iki nokta, tırnak ve girinti hatalarını tespit edip
// Monaco editöründe kırmızı/sarı dalgalı çizgiler (squigglies), fare üzerine gelince ipucu (tooltip)
// ve alt "Sorunlar" (Problems) panelinde satıra tıklandığında anında atlama sunar.

import * as monaco from 'monaco-editor';

export class CodeDiagnosticsEngine {
  private static instance: CodeDiagnosticsEngine | null = null;
  private validationTimers = new Map<string, number>();

  public static getInstance(): CodeDiagnosticsEngine {
    if (!CodeDiagnosticsEngine.instance) {
      CodeDiagnosticsEngine.instance = new CodeDiagnosticsEngine();
    }
    return CodeDiagnosticsEngine.instance;
  }

  constructor() {
    this.configureMonacoDefaults();
  }

  /**
   * Monaco'nun yerleşik TypeScript, CSS ve JSON dil denetleyicilerini tam teşhis moduna alır
   */
  public configureMonacoDefaults(): void {
    try {
      if (monaco.languages?.typescript) {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTextExtensions: true,
          allowJs: true,
          checkJs: true,
        });
      }

      if (monaco.languages?.json) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
          trailingCommas: 'error',
        });
      }

      if (monaco.languages?.css) {
        monaco.languages.css.cssDefaults.setDiagnosticsOptions({
          validate: true,
          lint: {
            emptyRules: 'warning',
            unknownProperties: 'warning',
          },
        });
      }
    } catch (e) {
      console.warn('[CodeDiagnosticsEngine] Monaco defaults konfigürasyonu hatası:', e);
    }
  }

  /**
   * Belirtilen model için 200ms gecikmeli teşhis kuyruğa alır (debounce)
   */
  public scheduleValidation(model: monaco.editor.ITextModel, delayMs: number = 200): void {
    const uriStr = model.uri.toString();
    const existing = this.validationTimers.get(uriStr);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(() => {
      this.validationTimers.delete(uriStr);
      if (!model.isDisposed()) {
        this.runValidation(model);
      }
    }, delayMs);

    this.validationTimers.set(uriStr, timer);
  }

  /**
   * Belirtilen model üzerinde dile özel analiz yapar ve Monaco işaretçilerini ayarlar
   */
  public runValidation(model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
    if (model.isDisposed()) return [];

    const language = model.getLanguageId().toLowerCase();
    const content = model.getValue();
    const markers: monaco.editor.IMarkerData[] = [];

    switch (language) {
      case 'html':
      case 'htm':
      case 'xml':
        this.validateHtml(content, model, markers);
        break;
      case 'javascript':
      case 'typescript':
      case 'javascriptreact':
      case 'typescriptreact':
        this.validateJsTs(content, model, markers);
        break;
      case 'json':
        this.validateJson(content, model, markers);
        break;
      case 'css':
      case 'scss':
      case 'less':
        this.validateCss(content, model, markers);
        break;
      case 'python':
        this.validatePython(content, model, markers);
        break;
    }

    monaco.editor.setModelMarkers(model, 'kraga-diagnostics', markers);
    return markers;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. HTML / XML Doğrulayıcısı (Kapanmamış etiketler, eşleşmeyen etiketler, tırnaklar)
  // ──────────────────────────────────────────────────────────────────────────
  private validateHtml(
    content: string,
    model: monaco.editor.ITextModel,
    markers: monaco.editor.IMarkerData[]
  ): void {
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    const tagStack: { tag: string; line: number; col: number; raw: string }[] = [];
    const idMap = new Map<string, { line: number; col: number }>();

    // Etiketleri sırayla tara: <tag attr="val"> veya </tag>
    const tagRegex = /<([!\/]?[a-zA-Z0-9_-]+)([^>]*?)(\/?)>/g;
    let match: RegExpExecArray | null;

    // Satır bazlı tırnak kontrolü ve ID tespiti
    const lines = content.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      const lineText = lines[lineIdx];

      // Kapanmamış tırnak kontrolü attribute içinde
      let inAttrDoubleQuote = false;
      let inAttrSingleQuote = false;
      let inTag = false;

      for (let cIdx = 0; cIdx < lineText.length; cIdx++) {
        const char = lineText[cIdx];
        if (char === '<' && !inAttrDoubleQuote && !inAttrSingleQuote) {
          inTag = true;
        } else if (char === '>' && !inAttrDoubleQuote && !inAttrSingleQuote) {
          inTag = false;
        } else if (inTag) {
          if (char === '"' && !inAttrSingleQuote) {
            inAttrDoubleQuote = !inAttrDoubleQuote;
          } else if (char === "'" && !inAttrDoubleQuote) {
            inAttrSingleQuote = !inAttrSingleQuote;
          }
        }
      }

      if (inAttrDoubleQuote || inAttrSingleQuote) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `HTML özniteliğinde (attribute) kapanmamış tırnak işareti tespit edildi.`,
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: lineText.length + 1,
          source: 'HTML Linter',
          code: 'html-unclosed-quote',
        });
      }
    }

    // HTML etiket yığını analizi (Doctype, script, style ve normal etiketler)
    // Script ve style bloklarının içini etiket aramasından geçici olarak arındır
    const sanitizedHtml = content.replace(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi, (m, tagName) => {
      return `<${tagName}>` + ' '.repeat(m.length - tagName.length * 2 - 5) + `</${tagName}>`;
    });

    while ((match = tagRegex.exec(sanitizedHtml)) !== null) {
      const fullMatch = match[0];
      const rawTag = match[1];
      const attributes = match[2];
      const isSelfClosing = match[3] === '/' || fullMatch.endsWith('/>');
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + fullMatch.length);

      // HTML Yorumları ve doctype atla
      if (rawTag.startsWith('!--') || rawTag.toLowerCase().startsWith('!doctype')) {
        continue;
      }

      // ID tekrar kontrolü
      const idMatch = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        const idVal = idMatch[1];
        if (idMap.has(idVal)) {
          const prev = idMap.get(idVal)!;
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `Yinelenen HTML ID değeri: "${idVal}". (Daha önce satır ${prev.line}'de tanımlanmış)`,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
            source: 'HTML Linter',
            code: 'html-duplicate-id',
          });
        } else {
          idMap.set(idVal, { line: startPos.lineNumber, col: startPos.column });
        }
      }

      // Kapanış etiketi: </tag>
      if (rawTag.startsWith('/')) {
        const closeTag = rawTag.slice(1).toLowerCase();
        if (voidTags.has(closeTag)) {
          markers.push({
            severity: monaco.MarkerSeverity.Info,
            message: `<${closeTag}> boş bir (void) etikettir, kapanış etiketi gerekmez: </${closeTag}>.`,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
            source: 'HTML Linter',
            code: 'html-void-tag',
          });
          continue;
        }

        if (tagStack.length === 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Açılışı bulunmayan yetim kapanış etiketi: </${closeTag}>`,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
            source: 'HTML Linter',
            code: 'html-unmatched-closing',
          });
        } else {
          const last = tagStack[tagStack.length - 1];
          if (last.tag === closeTag) {
            tagStack.pop();
          } else {
            // Eşleşmeyen etiket (Örn: <div></span>)
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Mismatched HTML tag: <${last.tag}> etiketi açılmış ancak </${closeTag}> ile kapatılmış.`,
              startLineNumber: startPos.lineNumber,
              startColumn: startPos.column,
              endLineNumber: endPos.lineNumber,
              endColumn: endPos.column,
              source: 'HTML Linter',
              code: 'html-tag-mismatch',
            });
            // Yığında bu etiketi arayıp kapat
            const foundIdx = tagStack.map((t) => t.tag).lastIndexOf(closeTag);
            if (foundIdx !== -1) {
              tagStack.splice(foundIdx);
            }
          }
        }
      } else {
        // Açılış etiketi: <tag>
        const openTag = rawTag.toLowerCase();
        if (!voidTags.has(openTag) && !isSelfClosing) {
          tagStack.push({
            tag: openTag,
            line: startPos.lineNumber,
            col: startPos.column,
            raw: fullMatch,
          });
        }
      }
    }

    // Kapanmamış kalan etiketler
    for (const unclosed of tagStack) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Kapanmamış HTML etiketi: <${unclosed.tag}> kapatılmadı. (Satır ${unclosed.line})`,
        startLineNumber: unclosed.line,
        startColumn: unclosed.col,
        endLineNumber: unclosed.line,
        endColumn: unclosed.col + unclosed.tag.length + 2,
        source: 'HTML Linter',
        code: 'html-unclosed-tag',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. JavaScript / TypeScript Doğrulayıcısı (Parantez uyumu, stringler, sözdizimi)
  // ──────────────────────────────────────────────────────────────────────────
  private validateJsTs(
    content: string,
    model: monaco.editor.ITextModel,
    markers: monaco.editor.IMarkerData[]
  ): void {
    const bracketStack: { char: string; line: number; col: number; pos: number }[] = [];
    const bracketPairs: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
    const openingBrackets = new Set(['{', '(', '[']);
    const closingBrackets = new Set(['}', ')', ']']);

    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let inString: string | null = null;
    let isEscaped = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = i + 1 < content.length ? content[i + 1] : '';
      const pos = model.getPositionAt(i);

      if (inSingleLineComment) {
        if (char === '\n') {
          inSingleLineComment = false;
        }
        continue;
      }

      if (inMultiLineComment) {
        if (char === '*' && nextChar === '/') {
          inMultiLineComment = false;
          i++;
        }
        continue;
      }

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }
        if (char === '\\') {
          isEscaped = true;
          continue;
        }
        if (char === inString) {
          inString = null;
        }
        continue;
      }

      // Yorum başlangıcı kontrolü
      if (char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i++;
        continue;
      }

      // String başlangıcı kontrolü
      if (char === '"' || char === "'" || char === '`') {
        inString = char;
        continue;
      }

      // Parantez kontrolü
      if (openingBrackets.has(char)) {
        bracketStack.push({ char, line: pos.lineNumber, col: pos.column, pos: i });
      } else if (closingBrackets.has(char)) {
        const expectedOpening = bracketPairs[char];
        if (bracketStack.length === 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Beklenmeyen kapanış parantezi: '${char}' (Açılış parantezi bulunamadı)`,
            startLineNumber: pos.lineNumber,
            startColumn: pos.column,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column + 1,
            source: 'JS/TS Linter',
            code: 'unmatched-bracket',
          });
        } else {
          const top = bracketStack.pop()!;
          if (top.char !== expectedOpening) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Eşleşmeyen parantez: '${top.char}' açıldı ancak '${char}' ile kapatıldı. (Satır ${top.line}:${top.col})`,
              startLineNumber: pos.lineNumber,
              startColumn: pos.column,
              endLineNumber: pos.lineNumber,
              endColumn: pos.column + 1,
              source: 'JS/TS Linter',
              code: 'mismatched-bracket',
            });
          }
        }
      }
    }

    // Kapanmamış string tespiti
    if (inString) {
      const lastLine = model.getLineCount();
      const lastCol = model.getLineMaxColumn(lastLine);
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Kapanmamış dizgi (string literal): ${inString} kapatılmadan dosya sonuna ulaşıldı.`,
        startLineNumber: lastLine,
        startColumn: Math.max(1, lastCol - 1),
        endLineNumber: lastLine,
        endColumn: lastCol,
        source: 'JS/TS Linter',
        code: 'unclosed-string',
      });
    }

    // Kapanmamış parantezler
    for (const b of bracketStack) {
      const closingName = b.char === '{' ? '}' : b.char === '(' ? ')' : ']';
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Kapanmamış parantez: '${b.char}' kapatılmadı, beklenen '${closingName}'.`,
        startLineNumber: b.line,
        startColumn: b.col,
        endLineNumber: b.line,
        endColumn: b.col + 1,
        source: 'JS/TS Linter',
        code: 'unclosed-bracket',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. JSON Doğrulayıcısı (JSON.parse ve hassas satır/sütun hesabı)
  // ──────────────────────────────────────────────────────────────────────────
  private validateJson(
    content: string,
    model: monaco.editor.ITextModel,
    markers: monaco.editor.IMarkerData[]
  ): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      JSON.parse(content);
    } catch (err: any) {
      const errMsg = err?.message || 'Geçersiz JSON sözdizimi';
      let errorLine = 1;
      let errorCol = 1;

      // Chrome/V8 hata formatı: "Unexpected token X in JSON at position Y"
      const posMatch = errMsg.match(/at position (\d+)/i);
      if (posMatch) {
        const charIdx = parseInt(posMatch[1], 10);
        const pos = model.getPositionAt(charIdx);
        errorLine = pos.lineNumber;
        errorCol = pos.column;
      } else {
        // Line X column Y formatı
        const lineColMatch = errMsg.match(/line (\d+) column (\d+)/i);
        if (lineColMatch) {
          errorLine = parseInt(lineColMatch[1], 10);
          errorCol = parseInt(lineColMatch[2], 10);
        } else {
          // Virgülden sonraki kapanış tespiti (trailing comma)
          const trailingCommaMatch = content.match(/,\s*([\}\]])/);
          if (trailingCommaMatch && trailingCommaMatch.index !== undefined) {
            const pos = model.getPositionAt(trailingCommaMatch.index);
            errorLine = pos.lineNumber;
            errorCol = pos.column;
          }
        }
      }

      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `JSON Sözdizimi Hatası: ${errMsg}`,
        startLineNumber: errorLine,
        startColumn: Math.max(1, errorCol - 1),
        endLineNumber: errorLine,
        endColumn: errorCol + 5,
        source: 'JSON Linter',
        code: 'json-syntax-error',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CSS Doğrulayıcısı (Parantez denetimi, eksik noktalı virgül uyarısı)
  // ──────────────────────────────────────────────────────────────────────────
  private validateCss(
    content: string,
    _model: monaco.editor.ITextModel,
    markers: monaco.editor.IMarkerData[]
  ): void {
    const braceStack: { line: number; col: number }[] = [];
    const lines = content.split('\n');

    let inComment = false;

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const lineNum = lIdx + 1;
      const line = lines[lIdx];
      const trimmed = line.trim();

      if (inComment) {
        if (line.includes('*/')) {
          inComment = false;
        }
        continue;
      }

      if (line.includes('/*') && !line.includes('*/')) {
        inComment = true;
        continue;
      }

      // Parantez sayımı
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '{') {
          braceStack.push({ line: lineNum, col: c + 1 });
        } else if (line[c] === '}') {
          if (braceStack.length === 0) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Beklenmeyen fazlalık kapanış parantezi: '}'`,
              startLineNumber: lineNum,
              startColumn: c + 1,
              endLineNumber: lineNum,
              endColumn: c + 2,
              source: 'CSS Linter',
              code: 'css-unexpected-brace',
            });
          } else {
            braceStack.pop();
          }
        }
      }

      // Özellik içinde eksik noktalı virgül uyarısı (kural bloğu içindeyse)
      if (braceStack.length > 0 && trimmed.length > 0) {
        if (
          trimmed.includes(':') &&
          !trimmed.endsWith(';') &&
          !trimmed.endsWith('{') &&
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('/*') &&
          !trimmed.startsWith('@')
        ) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `CSS özelliğinin sonunda noktalı virgül (;) eksik olabilir.`,
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: line.length + 1,
            source: 'CSS Linter',
            code: 'css-missing-semicolon',
          });
        }
      }
    }

    for (const b of braceStack) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Kapanmamış CSS bloğu: '{' parantezi kapatılmadı.`,
        startLineNumber: b.line,
        startColumn: b.col,
        endLineNumber: b.line,
        endColumn: b.col + 1,
        source: 'CSS Linter',
        code: 'css-unclosed-brace',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Python Doğrulayıcısı (Eksik iki nokta, parantez uyumu, girinti tutarsızlığı)
  // ──────────────────────────────────────────────────────────────────────────
  private validatePython(
    content: string,
    model: monaco.editor.ITextModel,
    markers: monaco.editor.IMarkerData[]
  ): void {
    const lines = content.split('\n');
    const bracketStack: { char: string; line: number; col: number }[] = [];
    const bracketPairs: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
    const openingBrackets = new Set(['{', '(', '[']);
    const closingBrackets = new Set(['}', ')', ']']);

    let inTripleSingleQuote = false;
    let inTripleDoubleQuote = false;

    // Python blok başlatan anahtar kelimeler (sonunda ':' zorunlu olanlar)
    const blockKeywordsRegex = /^\s*(def\s+[a-zA-Z0-9_]+\s*\(.*?\)|class\s+[a-zA-Z0-9_]+(?:\(.*?\))?|if\s+.+|elif\s+.+|else|for\s+.+\s+in\s+.+|while\s+.+|try|except(?:\s+.+)?|finally|with\s+.+)\s*$/;

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const lineNum = lIdx + 1;
      const line = lines[lIdx];
      const trimmed = line.trim();

      // Üçlü tırnak içi kontrolü
      if (line.includes("'''")) {
        const count = (line.match(/'''/g) || []).length;
        if (count % 2 !== 0) inTripleSingleQuote = !inTripleSingleQuote;
      }
      if (line.includes('"""')) {
        const count = (line.match(/"""/g) || []).length;
        if (count % 2 !== 0) inTripleDoubleQuote = !inTripleDoubleQuote;
      }

      if (inTripleSingleQuote || inTripleDoubleQuote || trimmed.startsWith('#') || trimmed.length === 0) {
        continue;
      }

      // Parantez kontrolü
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (openingBrackets.has(ch)) {
          bracketStack.push({ char: ch, line: lineNum, col: c + 1 });
        } else if (closingBrackets.has(ch)) {
          const expected = bracketPairs[ch];
          if (bracketStack.length === 0) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Python SyntaxError: Beklenmeyen kapanış parantezi '${ch}'`,
              startLineNumber: lineNum,
              startColumn: c + 1,
              endLineNumber: lineNum,
              endColumn: c + 2,
              source: 'Python Linter',
              code: 'python-unexpected-bracket',
            });
          } else {
            const top = bracketStack.pop()!;
            if (top.char !== expected) {
              markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: `Python SyntaxError: '${top.char}' açıldı ancak '${ch}' ile kapatıldı. (Satır ${top.line})`,
                startLineNumber: lineNum,
                startColumn: c + 1,
                endLineNumber: lineNum,
                endColumn: c + 2,
                source: 'Python Linter',
                code: 'python-mismatched-bracket',
              });
            }
          }
        }
      }

      // Sekme (tab) ve boşluk karışımı kontrolü (TabError)
      if (/^\t+ +/.test(line) || /^ +\t+/.test(line)) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Python TabError: Girintide boşluk (space) ve sekme (tab) birlikte kullanılmış.`,
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: line.search(/\S/) + 1,
          source: 'Python Linter',
          code: 'python-tab-error',
        });
      }

      // Eksik iki nokta (':') kontrolü
      if (
        blockKeywordsRegex.test(trimmed) &&
        !trimmed.endsWith(':') &&
        !trimmed.endsWith('\\') &&
        bracketStack.length === 0
      ) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Python SyntaxError: Blok bildiriminin sonunda ':' (iki nokta üst üste) eksik.`,
          startLineNumber: lineNum,
          startColumn: line.length,
          endLineNumber: lineNum,
          endColumn: line.length + 1,
          source: 'Python Linter',
          code: 'python-missing-colon',
        });
      }
    }

    for (const b of bracketStack) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Python SyntaxError: Kapanmamış parantez: '${b.char}' (Satır ${b.line}:${b.col})`,
        startLineNumber: b.line,
        startColumn: b.col,
        endLineNumber: b.line,
        endColumn: b.col + 1,
        source: 'Python Linter',
        code: 'python-unclosed-bracket',
      });
    }

    if (inTripleSingleQuote || inTripleDoubleQuote) {
      const lastLine = model.getLineCount();
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Python SyntaxError: Kapanmamış üçlü tırnak string bloğu (docstring).`,
        startLineNumber: lastLine,
        startColumn: 1,
        endLineNumber: lastLine,
        endColumn: model.getLineMaxColumn(lastLine),
        source: 'Python Linter',
        code: 'python-unclosed-docstring',
      });
    }
  }
}
