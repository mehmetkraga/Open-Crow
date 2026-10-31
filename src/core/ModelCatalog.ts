export interface ModelInfo {
  id: string;
  name: string;
  category: 'eco' | 'daily' | 'pro' | 'flagship' | 'image';
  categoryLabel: string;
  multiplier: number;
  inputMultiplier?: number;
  outputMultiplier?: number;
  cacheWriteMultiplier?: number;
  cacheReadMultiplier?: number;
  contextLimit: number;
  maxOutput: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsThinking?: boolean;
  supportsImages?: boolean;
  badge?: string;
}

export interface EffortLevel {
  id: 'light' | 'low' | 'medium' | 'high' | 'extra' | 'max';
  label: string;
  description: string;
  isDefault?: boolean;
}

const MODELS: ModelInfo[] = [
  // Eco (Hızlı & Ucuz)
  {
    id: 'haiku-4-5',
    name: 'Claude Haiku 4.5',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.5,
    inputMultiplier: 0.5,
    outputMultiplier: 2.5,
    cacheWriteMultiplier: 0.625,
    cacheReadMultiplier: 0.05,
    contextLimit: 200000,
    maxOutput: 8192,
    inputCostPer1M: 1.00,
    outputCostPer1M: 5.00,
  },
  {
    id: 'haiku-3-5',
    name: 'Claude Haiku 3.5',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.5,
    inputMultiplier: 0.5,
    outputMultiplier: 2.5,
    cacheWriteMultiplier: 0.625,
    cacheReadMultiplier: 0.05,
    contextLimit: 200000,
    maxOutput: 8192,
    inputCostPer1M: 1.00,
    outputCostPer1M: 5.00,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.5,
    inputMultiplier: 0.5,
    outputMultiplier: 2.5,
    cacheWriteMultiplier: 0.625,
    cacheReadMultiplier: 0.05,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 0.50,
    outputCostPer1M: 3.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.5,
    inputMultiplier: 0.5,
    outputMultiplier: 2.5,
    cacheWriteMultiplier: 0.625,
    cacheReadMultiplier: 0.05,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 0.50,
    outputCostPer1M: 3.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.35,
    inputMultiplier: 0.35,
    outputMultiplier: 2.0,
    cacheWriteMultiplier: 0.5,
    cacheReadMultiplier: 0.04,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 0.35,
    outputCostPer1M: 2.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT 5.4 Mini',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.38,
    inputMultiplier: 0.375,
    outputMultiplier: 2.25,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.0375,
    contextLimit: 128000,
    maxOutput: 16384,
    inputCostPer1M: 0.75,
    outputCostPer1M: 4.50,
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT 5.6 Luna',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.5,
    inputMultiplier: 0.5,
    outputMultiplier: 3.0,
    cacheWriteMultiplier: 0.625,
    cacheReadMultiplier: 0.05,
    contextLimit: 1000000,
    maxOutput: 16384,
    inputCostPer1M: 1.00,
    outputCostPer1M: 6.00,
    badge: '1M',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT 4o Mini',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.4,
    inputMultiplier: 0.15,
    outputMultiplier: 0.60,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.015,
    contextLimit: 128000,
    maxOutput: 16384,
    inputCostPer1M: 0.30,
    outputCostPer1M: 1.20,
  },
  {
    id: 'codex-auto-review',
    name: 'Codex Auto Review',
    category: 'eco',
    categoryLabel: 'Hızlı & Ucuz',
    multiplier: 0.63,
    inputMultiplier: 0.625,
    outputMultiplier: 5.0,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.0625,
    contextLimit: 128000,
    maxOutput: 16384,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },

  // Daily (Günlük)
  {
    id: 'sonnet-5',
    name: 'Claude Sonnet 5',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.0,
    inputMultiplier: 1.0,
    outputMultiplier: 5.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 2.00,
    outputCostPer1M: 10.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.5,
    inputMultiplier: 1.5,
    outputMultiplier: 7.5,
    cacheWriteMultiplier: 1.875,
    cacheReadMultiplier: 0.15,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    badge: '1M',
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.0,
    inputMultiplier: 1.0,
    outputMultiplier: 5.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    contextLimit: 200000,
    maxOutput: 65536,
    inputCostPer1M: 2.00,
    outputCostPer1M: 10.00,
    supportsThinking: true,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.0,
    inputMultiplier: 1.0,
    outputMultiplier: 5.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    contextLimit: 200000,
    maxOutput: 8192,
    inputCostPer1M: 2.00,
    outputCostPer1M: 10.00,
  },
  {
    id: 'gpt-4o',
    name: 'GPT 4o',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.0,
    inputMultiplier: 1.0,
    outputMultiplier: 5.0,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.1,
    contextLimit: 128000,
    maxOutput: 16384,
    inputCostPer1M: 2.00,
    outputCostPer1M: 10.00,
  },
  {
    id: 'gpt-5.4',
    name: 'GPT 5.4',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.25,
    inputMultiplier: 1.25,
    outputMultiplier: 7.5,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.125,
    contextLimit: 1000000,
    maxOutput: 16384,
    inputCostPer1M: 2.50,
    outputCostPer1M: 15.00,
    badge: '1M',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT 5.6 Terra',
    category: 'daily',
    categoryLabel: 'Günlük',
    multiplier: 1.25,
    inputMultiplier: 1.25,
    outputMultiplier: 7.5,
    cacheWriteMultiplier: 1.5625,
    cacheReadMultiplier: 0.125,
    contextLimit: 1000000,
    maxOutput: 16384,
    inputCostPer1M: 2.50,
    outputCostPer1M: 15.00,
    badge: '1M',
  },

  // Pro (Profesyonel)
  {
    id: 'opus-5',
    name: 'Claude Opus 5',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 12.5,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'opus-4-8',
    name: 'Claude Opus 4.8',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 12.5,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'opus-4-7',
    name: 'Claude Opus 4.7',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 12.5,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    badge: '1M',
  },
  {
    id: 'opus-4-6',
    name: 'Claude Opus 4.6',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 12.5,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    badge: '1M',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 12.5,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 200000,
    maxOutput: 4096,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 1.5,
    inputMultiplier: 1.5,
    outputMultiplier: 7.5,
    cacheWriteMultiplier: 1.875,
    cacheReadMultiplier: 0.15,
    contextLimit: 1000000,
    maxOutput: 65536,
    inputCostPer1M: 2.50,
    outputCostPer1M: 15.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 1.5,
    inputMultiplier: 1.5,
    outputMultiplier: 7.5,
    cacheWriteMultiplier: 1.875,
    cacheReadMultiplier: 0.15,
    contextLimit: 2000000,
    maxOutput: 65536,
    inputCostPer1M: 2.50,
    outputCostPer1M: 15.00,
    supportsThinking: true,
    badge: '2M',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT 5.5',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 15.0,
    cacheWriteMultiplier: 0,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 102400,
    inputCostPer1M: 5.00,
    outputCostPer1M: 30.00,
    badge: '1M',
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT 5.6 Sol',
    category: 'pro',
    categoryLabel: 'Profesyonel',
    multiplier: 2.5,
    inputMultiplier: 2.5,
    outputMultiplier: 15.0,
    cacheWriteMultiplier: 3.125,
    cacheReadMultiplier: 0.25,
    contextLimit: 1000000,
    maxOutput: 102400,
    inputCostPer1M: 5.00,
    outputCostPer1M: 30.00,
    badge: '1M',
  },

  // Flagship (Amiral Gemisi)
  {
    id: 'claude-fable-5.1-1m',
    name: 'Claude Fable 5.1 1M',
    category: 'flagship',
    categoryLabel: 'Amiral Gemisi',
    multiplier: 5.0,
    inputMultiplier: 5.0,
    outputMultiplier: 25.0,
    cacheWriteMultiplier: 6.25,
    cacheReadMultiplier: 0.5,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 10.00,
    outputCostPer1M: 50.00,
    supportsThinking: true,
    badge: '1M ctx',
  },
  {
    id: 'claude-fable-5.1',
    name: 'Claude Fable 5.1',
    category: 'flagship',
    categoryLabel: 'Amiral Gemisi',
    multiplier: 5.0,
    inputMultiplier: 5.0,
    outputMultiplier: 25.0,
    cacheWriteMultiplier: 6.25,
    cacheReadMultiplier: 0.5,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 10.00,
    outputCostPer1M: 50.00,
    supportsThinking: true,
    badge: '1M',
  },
  {
    id: 'claude-fable-5-1m',
    name: 'Claude Fable 5 1M',
    category: 'flagship',
    categoryLabel: 'Amiral Gemisi',
    multiplier: 5.0,
    inputMultiplier: 5.0,
    outputMultiplier: 25.0,
    cacheWriteMultiplier: 6.25,
    cacheReadMultiplier: 0.5,
    contextLimit: 1000000,
    maxOutput: 131072,
    inputCostPer1M: 10.00,
    outputCostPer1M: 50.00,
    supportsThinking: true,
    badge: '1M ctx',
  },
  {
    id: 'gpt-6-astra',
    name: 'GPT 6 Astra',
    category: 'flagship',
    categoryLabel: 'Amiral Gemisi',
    multiplier: 5.0,
    inputMultiplier: 5.0,
    outputMultiplier: 25.0,
    cacheWriteMultiplier: 6.25,
    cacheReadMultiplier: 0.5,
    contextLimit: 1050000,
    maxOutput: 102400,
    inputCostPer1M: 10.00,
    outputCostPer1M: 50.00,
    badge: '1M ctx',
  },

  // Image (Görsel)
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    category: 'image',
    categoryLabel: 'Görsel',
    multiplier: 0.5,
    contextLimit: 128000,
    maxOutput: 8192,
    inputCostPer1M: 2.00,
    outputCostPer1M: 2.00,
    supportsImages: true,
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    category: 'image',
    categoryLabel: 'Görsel',
    multiplier: 1.0,
    contextLimit: 128000,
    maxOutput: 8192,
    inputCostPer1M: 2.00,
    outputCostPer1M: 10.00,
    supportsImages: true,
  },
];

const EFFORT_LEVELS: EffortLevel[] = [
  { id: 'light', label: 'Hafif', description: 'Hızlı ve az kaynak tüketimi' },
  { id: 'low', label: 'Düşük', description: 'Günlük basit işler için' },
  { id: 'medium', label: 'Orta', description: 'Dengeli performans', isDefault: true },
  { id: 'high', label: 'Yüksek', description: 'Daha kapsamlı ve derin yanıtlar' },
  { id: 'max', label: 'Ultra', description: 'Maksimum akıl yürütme & derin analiz' },
];

const ACTIVE_MODELS_STORAGE_KEY = 'kraga:active-models';

/**
 * Model adındaki efor eklerini (-high, -medium, -low, -ultra, -max) katlar / temizler.
 * Örnek: gemini-3.8-flash-low -> gemini-3.8-flash
 */
export function foldEffortSuffix(id: string): string {
  return (id || '').replace(/[-_](?:high|medium|low|ultra|max)$/i, '');
}

/**
 * Model ID'sinden temiz, profesyonel bir gösterim adı türetir.
 */
export function formatPrettyModelName(id: string, rawName?: string): string {
  if (rawName && !/[-_](?:high|medium|low|ultra|max)$/i.test(rawName)) {
    return rawName;
  }
  const clean = foldEffortSuffix(id);
  if (clean.startsWith('gemini-')) {
    const parts = clean.replace('gemini-', '').split('-');
    const version = parts[0] || '';
    const variant = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return `Gemini ${version} ${variant}`.trim();
  }
  if (clean.startsWith('gpt-')) {
    const parts = clean.replace('gpt-', '').split('-');
    const version = parts[0] || '';
    const variant = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return `GPT ${version} ${variant}`.trim();
  }
  if (clean.startsWith('claude-')) {
    const parts = clean.replace('claude-', '').split('-');
    const version = parts.filter(p => !/^\d{8}$/.test(p));
    return `Claude ${version.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')}`.trim();
  }
  return clean
    .split(/[-_]/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Model ID'sine göre gerçekçi ve doğru bağlam penceresi (context limit) limitini çözer.
 * Gemini modelleri 1M / 2M, Claude 3/3.5/3.7 200K, Claude 5/Opus 1M, GPT-5/6 1M, GPT-4o 128K.
 */
export function resolveModelContextLimit(modelId: string): number {
  const m = (modelId || '').toLowerCase().trim();

  // 2M tokens
  if (m.includes('gemini-1.5-pro') || m.includes('gemini-2.5-pro') || m.includes('2m')) {
    return 2000000;
  }

  // 1M tokens (Gemini Flash & Pro serisi, Claude 5 serisi, GPT-5/6, Astra, Luna, Terra, Sol, Fable)
  if (
    m.includes('gemini') || 
    m.includes('1m') || 
    m.includes('luna') || 
    m.includes('terra') || 
    m.includes('sol') || 
    m.includes('astra') || 
    m.includes('fable') ||
    m.includes('sonnet-5') || 
    m.includes('sonnet-4-6') || 
    m.includes('opus-5') || 
    m.includes('opus-4') || 
    m.includes('gpt-5.4') ||
    m.includes('gpt-5.5') ||
    m.includes('gpt-5.6') ||
    m.includes('gpt-6')
  ) {
    return 1000000;
  }

  // 200K tokens (Claude 3 / 3.5 / 3.7, Haiku, o1, o3, o3-mini)
  if (
    m.includes('claude-3') || 
    m.includes('claude-2') || 
    m.includes('haiku') || 
    m.includes('sonnet') || 
    m.includes('opus') || 
    m.includes('o1') || 
    m.includes('o3')
  ) {
    return 200000;
  }

  // 64K tokens (DeepSeek standart)
  if (m.includes('64k') || m.includes('deepseek')) {
    return 64000;
  }

  // Standart varsayılan (GPT-4o, GPT-4o-mini, Qwen, Llama vb.)
  return 128000;
}

function loadSavedActiveModels(): ModelInfo[] {
  try {
    const raw = localStorage.getItem(ACTIVE_MODELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned: ModelInfo[] = [];
        const seen = new Set<string>();
        for (const m of parsed) {
          const foldedId = foldEffortSuffix(m.id);
          const lower = foldedId.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            const resolvedLimit = resolveModelContextLimit(foldedId);
            const finalLimit = (m.contextLimit && m.contextLimit > 128000) ? m.contextLimit : resolvedLimit;
            const finalBadge = finalLimit >= 2000000 ? '2M' : finalLimit >= 1000000 ? '1M' : (m.badge || 'Aktif');
            cleaned.push({
              ...m,
              id: foldedId,
              name: formatPrettyModelName(foldedId, m.name),
              contextLimit: finalLimit,
              badge: finalBadge,
            });
          }
        }
        return cleaned;
      }
    }
    return [];
  } catch {
    return [];
  }
}

let activeModels: ModelInfo[] = loadSavedActiveModels();

export function hasActiveProviderModels(): boolean {
  return activeModels.length > 0;
}

export function resetActiveModels(): void {
  activeModels = [];
  try {
    localStorage.removeItem(ACTIVE_MODELS_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('kraga:models-updated'));
}

export function registerCustomModel(modelId: string): ModelInfo {
  const cleanId = foldEffortSuffix(modelId.trim());
  const existing = getModelById(cleanId);
  if (existing) {
    if (!activeModels.some(m => m.id.toLowerCase() === cleanId.toLowerCase())) {
      activeModels.push(existing);
      try {
        localStorage.setItem(ACTIVE_MODELS_STORAGE_KEY, JSON.stringify(activeModels));
      } catch {}
      window.dispatchEvent(new CustomEvent('kraga:models-updated'));
    }
    return existing;
  }

  const contextLimit = resolveModelContextLimit(cleanId);
  const customModel: ModelInfo = {
    id: cleanId,
    name: formatPrettyModelName(cleanId),
    category: 'daily',
    categoryLabel: 'Özel Model',
    multiplier: 1.0,
    contextLimit,
    maxOutput: contextLimit >= 1000000 ? 65536 : 16384,
    inputCostPer1M: 2.0,
    outputCostPer1M: 10.0,
    badge: contextLimit >= 2000000 ? '2M' : contextLimit >= 1000000 ? '1M' : 'Özel',
  };
  activeModels.push(customModel);
  try {
    localStorage.setItem(ACTIVE_MODELS_STORAGE_KEY, JSON.stringify(activeModels));
  } catch {}
  window.dispatchEvent(new CustomEvent('kraga:models-updated'));
  return customModel;
}

export function registerPromoModels(rawModels: { id: string; name?: string }[]): ModelInfo[] {
  if (!Array.isArray(rawModels) || rawModels.length === 0) return getAllModels();

  const newActiveList: ModelInfo[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawModels) {
    if (!raw.id) continue;
    const cleanId = foldEffortSuffix(raw.id.trim());
    const lower = cleanId.toLowerCase();

    // Aynı taban modeli tekrar ekleme (deduplicate)
    if (seenIds.has(lower)) continue;
    seenIds.add(lower);

    const existing = MODELS.find(m => m.id.toLowerCase() === lower);

    if (existing) {
      newActiveList.push({
        ...existing,
        name: existing.name || formatPrettyModelName(cleanId, raw.name),
        badge: existing.badge || 'Aktif',
      });
    } else {
      const isEco = lower.includes('mini') || lower.includes('haiku') || lower.includes('flash') || lower.includes('small');
      const isFlagship = lower.includes('fable') || lower.includes('opus') || lower.includes('astra') || lower.includes('large');
      const isPro = lower.includes('pro') || lower.includes('sonnet') || lower.includes('plus');
      const category: ModelInfo['category'] = isEco ? 'eco' : isFlagship ? 'flagship' : isPro ? 'pro' : 'daily';
      const categoryLabel = isEco ? 'Hızlı & Ucuz' : isFlagship ? 'Amiral Gemisi' : isPro ? 'Profesyonel' : 'Günlük';

      const contextLimit = resolveModelContextLimit(cleanId);
      const promoModel: ModelInfo = {
        id: cleanId,
        name: formatPrettyModelName(cleanId, raw.name),
        category,
        categoryLabel,
        multiplier: isEco ? 0.5 : isFlagship ? 5.0 : isPro ? 2.5 : 1.0,
        contextLimit,
        maxOutput: contextLimit >= 1000000 ? 65536 : 16384,
        inputCostPer1M: isEco ? 0.75 : (isFlagship ? 10.0 : (isPro ? 5.0 : 2.0)),
        outputCostPer1M: isEco ? 4.5 : (isFlagship ? 50.0 : (isPro ? 25.0 : 10.0)),
        badge: contextLimit >= 2000000 ? '2M' : contextLimit >= 1000000 ? '1M' : 'Aktif',
        supportsThinking: isPro || isFlagship || lower.includes('flash') || lower.includes('gemini') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('gpt-5'),
      };
      newActiveList.push(promoModel);
    }
  }

  activeModels = newActiveList;

  try {
    localStorage.setItem(ACTIVE_MODELS_STORAGE_KEY, JSON.stringify(activeModels));
  } catch (e) {
    console.warn('[ModelCatalog] Aktif modeller kaydedilemedi:', e);
  }

  window.dispatchEvent(new CustomEvent('kraga:models-updated'));
  return getAllModels();
}

/**
 * Kullanılabilir modelleri döndürür.
 * Eğer BaseURL, API Key veya Promo üzerinden modeller çekilmişse SADECE o modelleri döndürür.
 * Böylece BaseURL içinde yer almayan modeller seçim listesini işgal etmez.
 */
export function getAllModels(): ModelInfo[] {
  if (activeModels && activeModels.length > 0) {
    return [...activeModels];
  }
  return [...MODELS];
}

export function getAllCatalogModels(): ModelInfo[] {
  return [...MODELS];
}

export function getModelById(id: string): ModelInfo | undefined {
  if (!id) return undefined;
  const lower = id.toLowerCase().trim();
  const activeMatch = getAllModels().find(m => m.id.toLowerCase() === lower);
  if (activeMatch) return activeMatch;
  return MODELS.find(m => m.id.toLowerCase() === lower);
}

export function getModelsByCategory(cat: ModelInfo['category']): ModelInfo[] {
  return getAllModels().filter(m => m.category === cat);
}

/**
 * En ucuz (en düşük maliyet çarpanına ve token maliyetine sahip) modeli bulur.
 * Promo modelleri çekildiğinde veya başlangıçta varsayılan olarak seçilir.
 */
export function getCheapestModel(modelsList?: ModelInfo[]): ModelInfo {
  const list = (modelsList && modelsList.length > 0) ? modelsList : getAllModels();
  if (!list || list.length === 0) {
    return MODELS[0];
  }

  // Kod ve sohbet için görsel modelleri hariç tut
  const textModels = list.filter(m => m.category !== 'image');
  const candidates = textModels.length > 0 ? textModels : list;

  // Çarpanı en düşük olanı, eşitlikte ise 1M token maliyeti en düşük olanı seç
  const sorted = [...candidates].sort((a, b) => {
    const multA = a.multiplier ?? 1.0;
    const multB = b.multiplier ?? 1.0;
    if (Math.abs(multA - multB) > 0.0001) {
      return multA - multB;
    }
    const costA = (a.inputCostPer1M ?? 0) + (a.outputCostPer1M ?? 0);
    const costB = (b.inputCostPer1M ?? 0) + (b.outputCostPer1M ?? 0);
    return costA - costB;
  });

  return sorted[0] || list[0] || MODELS[0];
}

export function getDefaultModel(): ModelInfo {
  return getCheapestModel();
}

export function getEffortLevels(): EffortLevel[] {
  return [...EFFORT_LEVELS];
}

export interface ReasoningLevelOption {
  id: string;
  label: string;
  description: string;
  badge?: string;
  budget?: number;
}

export interface ModelReasoningCapability {
  supportsThinking: boolean;
  canToggleThinking: boolean;
  effortType: 'none' | 'budget' | 'effort';
  availableLevels: ReasoningLevelOption[];
  defaultLevel: string;
  reasoningTitle?: string;
}

export function getModelReasoningCapabilities(modelId: string): ModelReasoningCapability {
  const cleanId = (modelId || '').toLowerCase().trim();

  // 1. Görsel modelleri
  if (cleanId.includes('image') || cleanId.includes('imagen') || cleanId.includes('flux') || cleanId.includes('banana')) {
    return {
      supportsThinking: false,
      canToggleThinking: false,
      effortType: 'none',
      availableLevels: [],
      defaultLevel: '',
      reasoningTitle: 'Görsel Üretim Modeli (Thinking Desteklenmez)',
    };
  }

  // 2. Claude Modelleri (Thinking toggle + Token Bütçesi)
  if (cleanId.includes('claude') || cleanId.includes('sonnet') || cleanId.includes('opus') || cleanId.includes('fable')) {
    if (cleanId.includes('haiku')) {
      return {
        supportsThinking: false,
        canToggleThinking: false,
        effortType: 'none',
        availableLevels: [],
        defaultLevel: '',
        reasoningTitle: 'Hızlı Model (Thinking Desteklenmez)',
      };
    }

    return {
      supportsThinking: true,
      canToggleThinking: true,
      effortType: 'budget',
      availableLevels: [
        { id: '1k', label: '1K', description: '1.024 token bütçesi — Hızlı & odaklı akıl yürütme', budget: 1024 },
        { id: '2k', label: '2K', description: '2.048 token bütçesi — Standart düşünme', budget: 2048 },
        { id: '4k', label: '4K', description: '4.096 token bütçesi — Dengeli analiz', budget: 4096 },
        { id: '8k', label: '8K', description: '8.192 token bütçesi — Derin mimari çözümleme', budget: 8192 },
        { id: '16k', label: '16K', description: '16.384 token bütçesi — Maksimum akıl yürütme & refactor', budget: 16384 },
      ],
      defaultLevel: '4k',
      reasoningTitle: 'Anthropic Düşünce Süreci (Thinking Budget)',
    };
  }

  // 3. Gemini Modelleri
  if (cleanId.includes('gemini')) {
    if (cleanId.includes('pro')) {
      return {
        supportsThinking: true,
        canToggleThinking: true,
        effortType: 'effort',
        availableLevels: [
          { id: 'low', label: 'Düşük', description: 'Hızlı akıl yürütme & düşük gecikme' },
          { id: 'high', label: 'Yüksek', description: 'Kapsamlı mantıksal analiz & derin planlama' },
        ],
        defaultLevel: 'high',
        reasoningTitle: 'Gemini Akıl Yürütme Düzeyi',
      };
    } else {
      return {
        supportsThinking: true,
        canToggleThinking: true,
        effortType: 'effort',
        availableLevels: [
          { id: 'low', label: 'Düşük', description: 'Hızlı kontrol ve hafif muhakeme' },
          { id: 'medium', label: 'Orta', description: 'Dengeli akıl yürütme' },
          { id: 'high', label: 'Yüksek', description: 'Genişletilmiş düşünce adımları' },
        ],
        defaultLevel: 'medium',
        reasoningTitle: 'Gemini Akıl Yürütme Düzeyi',
      };
    }
  }

  // 4. OpenAI Doğuştan Akıl Yürütme Modelleri
  if (
    /\b(o1|o3|o4)\b/i.test(cleanId) ||
    cleanId.includes('gpt-5') ||
    cleanId.includes('gpt-6') ||
    cleanId.includes('astra') ||
    cleanId.includes('luna') ||
    cleanId.includes('terra') ||
    cleanId.includes('sol')
  ) {
    if (cleanId.includes('mini')) {
      return {
        supportsThinking: true,
        canToggleThinking: false,
        effortType: 'effort',
        availableLevels: [
          { id: 'low', label: 'Düşük', description: 'Hızlı yanıt' },
          { id: 'medium', label: 'Orta', description: 'Dengeli analiz' },
        ],
        defaultLevel: 'low',
        reasoningTitle: 'Reasoning Effort',
      };
    }
    return {
      supportsThinking: true,
      canToggleThinking: false,
      effortType: 'effort',
      availableLevels: [
        { id: 'low', label: 'Düşük', description: 'Günlük basit işler ve hızlı yanıt' },
        { id: 'medium', label: 'Orta', description: 'Dengeli akıl yürütme ve problem çözme' },
        { id: 'high', label: 'Yüksek', description: 'Karmaşık mimari ve çok adımlı analiz' },
        { id: 'max', label: 'Ultra', description: 'Maksimum derinlik & kapsamlı çıkarım' },
      ],
      defaultLevel: 'medium',
      reasoningTitle: 'Reasoning Effort (Akıl Yürütme Eforu)',
    };
  }

  // 5. Standart Modeller (GPT-4o, Haiku, Codex vb.)
  return {
    supportsThinking: false,
    canToggleThinking: false,
    effortType: 'none',
    availableLevels: [],
    defaultLevel: '',
    reasoningTitle: 'Standart Model (Thinking Desteklenmez)',
  };
}

export function formatContextLimit(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.floor(tokens / 1000)}K`;
  }
  return tokens.toString();
}

export function formatCost(costPer1M: number): string {
  return `$${costPer1M.toFixed(2)}/M`;
}

export function calculateCost(model: ModelInfo, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000000) * model.inputCostPer1M;
  const outputCost = (outputTokens / 1000000) * model.outputCostPer1M;
  return inputCost + outputCost;
}

// Çarpan Renk Hiyerarşisi Helper'ı (Web Sitesiyle Birebir Uyumlu)
export type MultiplierTier = 'eco' | 'base' | 'mid' | 'pro' | 'flagship';

export function getMultiplierTier(multiplier: number): MultiplierTier {
  if (multiplier < 1.0) return 'eco';       // < 1.0x -> Yeşil
  if (multiplier === 1.0) return 'base';    // 1.0x -> Mavi / Camgöbeği
  if (multiplier < 2.5) return 'mid';       // 1.0x < mult < 2.5x -> Turuncu
  if (multiplier < 5.0) return 'pro';       // 2.5x <= mult < 5.0x -> Kırmızı
  return 'flagship';                        // >= 5.0x -> Mor / Magenta Gradyan
}

export function getMultiplierClass(multiplier: number): string {
  return `model-mult-badge--${getMultiplierTier(multiplier)}`;
}

export interface TokenUsageDetails {
  promptTokens: number;
  completionTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  webSearchUsed?: boolean;
}

/**
 * docs.ai.kraga.org/#pricing tablosuna göre kesin harcanan bakiye tokeni hesaplaması:
 * input x input multiplier
 * + output x output multiplier
 * + cache write x cache-write multiplier
 * + cache read x cache-read multiplier
 * + webSearch (Claude) -> +5.000 token
 * + 272K kuralı (GPT-5.4, 5.5, 5.6, GPT-6 Astra) -> girdi ve önbellek x2, çıktı x1.5
 */
export function calculateChargedTokens(
  usage: TokenUsageDetails,
  modelOrId: ModelInfo | string
): { prompt: number; completion: number; total: number } {
  const model = typeof modelOrId === 'string' ? getModelById(modelOrId) : modelOrId;
  const inTokens = usage.promptTokens || 0;
  const outTokens = usage.completionTokens || 0;
  const cacheWrite = usage.cacheWriteTokens || 0;
  const cacheRead = usage.cacheReadTokens || 0;
  const freshInput = Math.max(0, inTokens - cacheWrite - cacheRead);

  let inMult = model?.inputMultiplier ?? (model?.multiplier ?? 1.0);
  let outMult = model?.outputMultiplier ?? ((model?.multiplier ?? 1.0) * 5.0);
  let cWriteMult = model?.cacheWriteMultiplier ?? ((model?.multiplier ?? 1.0) * 1.25);
  let cReadMult = model?.cacheReadMultiplier ?? ((model?.multiplier ?? 1.0) * 0.1);

  // 272,000 token context penalty for GPT-5.4, 5.5, 5.6, and GPT-6 Astra
  const id = (model?.id || '').toLowerCase();
  const isApplicableGpt = id.includes('gpt-5.4') || id.includes('gpt-5.5') || id.includes('gpt-5.6') || id.includes('gpt-6') || id.includes('astra');
  if (isApplicableGpt && inTokens > 272000) {
    inMult *= 2.0;
    cReadMult *= 2.0;
    cWriteMult *= 2.0;
    outMult *= 1.5;
  }

  const promptPart = Math.ceil((freshInput * inMult) + (cacheRead * cReadMult) + (cacheWrite * cWriteMult));
  const completionPart = Math.ceil(outTokens * outMult);
  const webSearchFee = usage.webSearchUsed ? 5000 : 0;

  return {
    prompt: promptPart,
    completion: completionPart,
    total: promptPart + completionPart + webSearchFee
  };
}

