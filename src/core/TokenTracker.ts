import { calculateChargedTokens, getModelById, calculateCost } from './ModelCatalog';

export interface TokenState {
  totalTokensUsed: number;
  totalCostUsed: number;
  tokenLimit: number;
  costLimit: number;
  requestCount: number;
  currentContextUsed: number;
  currentContextLimit: number;
  sessionTokens: number;
  lastModel: string;
  isPromoMode: boolean;
}

export class TokenTracker {
  private static instance: TokenTracker;
  private state: TokenState;
  private listeners: Map<string, Set<Function>> = new Map();

  private readonly STORAGE_KEY = 'kraga-token-state';

  private constructor() {
    this.state = this.getDefaultState();
    this.loadState();
  }

  public static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  private getDefaultState(): TokenState {
    return {
      totalTokensUsed: 0,
      totalCostUsed: 0,
      tokenLimit: 0,
      costLimit: 0,
      requestCount: 0,
      currentContextUsed: 0,
      currentContextLimit: 0,
      sessionTokens: 0,
      lastModel: '',
      isPromoMode: false,
    };
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = {
          ...this.getDefaultState(),
          ...parsed,
          sessionTokens: 0,
          currentContextUsed: 0,
          currentContextLimit: 0,
        };
      }
    } catch (e) {
      console.error('Failed to load token state', e);
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save token state', e);
    }
  }

  private emit(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(this.getState()));
    }
  }

  public on(event: 'update' | 'lowBalance' | 'criticalContext', callback: (state: TokenState) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  public addUsage(
    inputTokens: number,
    outputTokens: number,
    modelId: string,
    details?: { cacheWriteTokens?: number; cacheReadTokens?: number; webSearchUsed?: boolean }
  ): void {
    const charged = calculateChargedTokens(
      {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        cacheWriteTokens: details?.cacheWriteTokens,
        cacheReadTokens: details?.cacheReadTokens,
        webSearchUsed: details?.webSearchUsed
      },
      modelId
    );

    const modelInfo = getModelById(modelId);
    if (modelInfo) {
      const addedCost = calculateCost(modelInfo, inputTokens, outputTokens);
      this.state.totalCostUsed += addedCost;
    }

    this.state.totalTokensUsed += charged.total;
    this.state.sessionTokens += charged.total;
    this.state.requestCount += 1;
    this.state.lastModel = modelId;

    this.saveState();
    this.emit('update');

    if (this.isLowBalance()) {
      this.emit('lowBalance');
    }
  }

  public setContextUsage(used: number, limit: number): void {
    this.state.currentContextUsed = used;
    this.state.currentContextLimit = limit;
    this.emit('update');
    
    if (this.isCriticalContext()) {
      this.emit('criticalContext');
    }
  }

  public addMediaUsage(tokensUsed: number): void {
    this.state.totalTokensUsed += tokensUsed;
    this.state.sessionTokens += tokensUsed;
    this.saveState();
    this.emit('update');
  }

  public updatePromoStatus(data: { tokensUsed: number; tokenLimit: number; costUsed: number; costLimit: number }): void {
    this.state.totalTokensUsed = data.tokensUsed;
    this.state.tokenLimit = data.tokenLimit;
    this.state.totalCostUsed = data.costUsed;
    this.state.costLimit = data.costLimit;
    this.state.isPromoMode = true;
    
    this.saveState();
    this.emit('update');
  }

  public getState(): TokenState {
    return { ...this.state };
  }

  public getUsagePercentage(): number {
    if (!this.state.isPromoMode) return 0;
    
    if (this.state.costLimit > 0) {
      return (this.state.totalCostUsed / this.state.costLimit) * 100;
    }
    
    if (this.state.tokenLimit > 0) {
      return (this.state.totalTokensUsed / this.state.tokenLimit) * 100;
    }
    
    return 0;
  }

  public getContextPercentage(): number {
    if (this.state.currentContextLimit <= 0) return 0;
    return (this.state.currentContextUsed / this.state.currentContextLimit) * 100;
  }

  public isLowBalance(): boolean {
    if (!this.state.isPromoMode) return false;
    return this.getUsagePercentage() >= 80; // <= 20% remaining
  }

  public getRemainingPercentage(): number {
    if (!this.state.isPromoMode) return 100;
    if (this.state.costLimit <= 0 && this.state.tokenLimit <= 0) return 100;
    return Math.max(0, 100 - this.getUsagePercentage());
  }

  public isCriticalLowBalance(): boolean {
    if (!this.state.isPromoMode) return false;
    if (this.state.costLimit <= 0 && this.state.tokenLimit <= 0) return false;
    return this.getRemainingPercentage() <= 10;
  }

  public isDepleted(): boolean {
    if (!this.state.isPromoMode) return false;
    if (this.state.costLimit <= 0 && this.state.tokenLimit <= 0) return false;
    return this.getRemainingBalance() <= 0 || this.getRemainingPercentage() <= 0;
  }

  public isCriticalContext(): boolean {
    return this.getContextPercentage() >= 90;
  }

  public getRemainingBalance(): number {
    if (!this.state.isPromoMode) return Infinity;
    
    if (this.state.costLimit > 0) {
      return Math.max(0, this.state.costLimit - this.state.totalCostUsed);
    }
    
    if (this.state.tokenLimit > 0) {
      return Math.max(0, this.state.tokenLimit - this.state.totalTokensUsed);
    }
    
    return Infinity;
  }

  public isDollarPromo(): boolean {
    return this.state.costLimit > 0;
  }

  public getFormattedBalance(): string {
    if (!this.state.isPromoMode || (this.state.costLimit === 0 && this.state.tokenLimit === 0)) {
      return '\u221e'; // Infinity symbol
    }
    
    if (this.state.costLimit > 0) {
      const remaining = this.getRemainingBalance();
      return `$${remaining.toFixed(2)}`;
    }
    
    return this.formatNumber(this.getRemainingBalance());
  }

  // BYOK: kullanım harici sağlayıcıdan gelir, bu yüzden değerler tahmini olarak işaretlenir
  public isEstimated(): boolean {
    return true;
  }

  public getFormattedTokens(forceEstimated?: boolean): string {
    const base = this.formatNumber(this.state.totalTokensUsed);
    const estimated = forceEstimated !== undefined ? forceEstimated : this.isEstimated();
    return estimated ? `${base} (Tahmini)` : base;
  }

  public notifySettingsChanged(): void {
    this.emit('update');
  }

  public getFormattedRequests(): string {
    return this.formatNumber(this.state.requestCount);
  }

  public reset(): void {
    this.state = this.getDefaultState();
    this.saveState();
    this.emit('update');
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + 'B';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}
