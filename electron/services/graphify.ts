import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface CodeNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'module';
  filePath: string;
  inDegree: number;
  outDegree: number;
}

export interface CodeEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'defines';
}

export interface GraphReport {
  totalFiles: number;
  nodes: CodeNode[];
  edges: CodeEdge[];
  godNodes: CodeNode[];
}

const SUPPORTED_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.vite', 'build', 'coverage']);

export async function analyzeProjectGraph(projectPath: string): Promise<GraphReport> {
  const nodes = new Map<string, CodeNode>();
  const edges: CodeEdge[] = [];
  const filePaths: string[] = [];

  async function walk(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTS.has(ext)) {
            filePaths.push(full);
          }
        }
      }
    } catch (err) {
      console.warn('Graphify walk hatası:', err);
    }
  }

  await walk(projectPath);

  // Dosya düğümlerini ekle
  for (const filePath of filePaths) {
    const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/');
    nodes.set(relPath, {
      id: relPath,
      name: path.basename(filePath),
      type: 'file',
      filePath: relPath,
      inDegree: 0,
      outDegree: 0,
    });
  }

  // Import ve bağımlılık taraması (Hafif Regex AST simülasyonu)
  const importRegex = /(?:import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
  const funcRegex = /(?:function\s+([a-zA-Z0-9_$]+)|const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+([a-zA-Z0-9_$]+))/g;

  for (const filePath of filePaths) {
    const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/');
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // 1. Fonksiyon ve Sınıf Tanımları
      let match: RegExpExecArray | null;
      while ((match = funcRegex.exec(content)) !== null) {
        const symbol = match[1] || match[2] || match[3];
        if (symbol && symbol.length > 2) {
          const symId = `${relPath}::${symbol}`;
          nodes.set(symId, {
            id: symId,
            name: symbol,
            type: match[3] ? 'class' : 'function',
            filePath: relPath,
            inDegree: 0,
            outDegree: 0,
          });
          edges.push({ from: relPath, to: symId, type: 'defines' });
        }
      }

      // 2. Import İlişkileri
      while ((match = importRegex.exec(content)) !== null) {
        const importTarget = match[1] || match[2];
        if (!importTarget) continue;

        // Yerel bağımlılık mı? (./ veya ../)
        if (importTarget.startsWith('.')) {
          const resolvedDir = path.dirname(filePath);
          const resolvedTarget = path.normalize(path.join(resolvedDir, importTarget));
          const targetRel = path.relative(projectPath, resolvedTarget).replace(/\\/g, '/');

          // Olası uzantıları kontrol et
          for (const ext of ['', '.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js']) {
            const candidate = targetRel + ext;
            if (nodes.has(candidate)) {
              edges.push({ from: relPath, to: candidate, type: 'imports' });
              break;
            }
          }
        }
      }
    } catch {
      // Okunamayan dosyaları atla
    }
  }

  // Dereceleri (in-degree & out-degree) hesapla
  for (const edge of edges) {
    const sourceNode = nodes.get(edge.from);
    const targetNode = nodes.get(edge.to);
    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  }

  const nodeList = Array.from(nodes.values());

  // En çok referans verilen "God Node"ları belirle
  const godNodes = [...nodeList]
    .filter((n) => n.type === 'file')
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 10);

  return {
    totalFiles: filePaths.length,
    nodes: nodeList,
    edges,
    godNodes,
  };
}
