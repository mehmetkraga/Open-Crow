// src/core/mermaidLoader.ts
// Mermaid ağır bir kütüphane: ilk diyagram gerektiğinde yüklenir, sonra aynı örnek kullanılır.

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

export function loadMermaid(): Promise<typeof import('mermaid').default> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#131620',
          primaryColor: '#1f2430',
          primaryTextColor: '#E6EDF3',
          primaryBorderColor: '#00f0ff',
          lineColor: '#00f0ff',
          secondaryColor: '#1a1d28',
          tertiaryColor: '#252936',
        },
      });
      return mod.default;
    });
  }
  return mermaidPromise;
}
