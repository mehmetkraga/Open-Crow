// src/core/NotificationManager.ts
// Kraga IDE — Bildirimler & Ses Motoru (Response Completions, In-App Cyber Toasts, Web Audio Chime & Desktop Notifications)

import { iconAlertTriangle, iconClose, iconZap, iconGift } from '../components/icons';

export interface ToastOptions {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export class NotificationManager {
  private static instance: NotificationManager;
  private audioCtx: AudioContext | null = null;

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Web Audio API ile saf, zarif ve fütüristik iki tonlu yumuşak bildirim sesi çalar.
   * Dış ses dosyasına ihtiyaç duymaz, tamamen yerel ve sıfır gecikmelidir.
   */
  public playChime(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 1. Ton: 587.33 Hz (D5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.29);

      // 2. Ton: 880 Hz (A5 - Parlak bitiş)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.07, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.43);
    } catch (e) {
      console.warn('[NotificationManager] Ses çalınamadı:', e);
    }
  }

  /**
   * Web Audio API ile nazik uyarı tonu çalar (düşük bakiye veya dikkat durumunda).
   */
  public playAlertTone(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 1. Ton: 440 Hz (A4)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.07, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.23);

      // 2. Ton: 349.23 Hz (F4)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(349.23, now + 0.08);
      gain2.gain.setValueAtTime(0.06, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.36);
    } catch (e) {
      console.warn('[NotificationManager] Uyarı sesi çalınamadı:', e);
    }
  }

  /**
   * Kraga IDE fütüristik dahili bildirim kartı (Toast) gösterir.
   */
  public showToast(options: ToastOptions): void {
    const { title, message, type = 'info', durationMs = 5000, action } = options;

    let container = document.getElementById('kragaToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'kragaToastContainer';
      container.className = 'kraga-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `kraga-toast kraga-toast--${type}`;

    let iconHtml = '';
    if (type === 'success') {
      iconHtml = `<div class="kraga-toast__icon-wrap kraga-toast__icon-wrap--success">${iconGift(18, '#00E676')}</div>`;
    } else if (type === 'warning') {
      iconHtml = `<div class="kraga-toast__icon-wrap kraga-toast__icon-wrap--warning">${iconAlertTriangle(18, '#FFB300')}</div>`;
    } else if (type === 'error') {
      iconHtml = `<div class="kraga-toast__icon-wrap kraga-toast__icon-wrap--error">${iconAlertTriangle(18, '#FF5555')}</div>`;
    } else {
      iconHtml = `<div class="kraga-toast__icon-wrap kraga-toast__icon-wrap--info">${iconZap(18, '#00F0FF')}</div>`;
    }

    let actionHtml = '';
    if (action) {
      actionHtml = `<button type="button" class="kraga-toast__action-btn">${action.label}</button>`;
    }

    toast.innerHTML = `
      ${iconHtml}
      <div class="kraga-toast__content">
        <div class="kraga-toast__title">${title}</div>
        ${message ? `<div class="kraga-toast__message">${message}</div>` : ''}
        ${actionHtml}
      </div>
      <button type="button" class="kraga-toast__close" title="Kapat">${iconClose(14)}</button>
      <div class="kraga-toast__progress" style="animation-duration: ${durationMs}ms;"></div>
    `;

    container.appendChild(toast);

    let isClosed = false;
    const removeToast = () => {
      if (isClosed) return;
      isClosed = true;
      toast.classList.add('kraga-toast--hiding');
      setTimeout(() => {
        toast.remove();
        if (container && container.children.length === 0) {
          container.remove();
        }
      }, 250);
    };

    if (action) {
      const btn = toast.querySelector('.kraga-toast__action-btn');
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        action.onClick();
        removeToast();
      });
    }

    const closeBtn = toast.querySelector('.kraga-toast__close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      removeToast();
    });

    let timer = setTimeout(removeToast, durationMs);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      if (!isClosed) {
        timer = setTimeout(removeToast, 2000);
      }
    });

    // Ses efekti
    if (type === 'success' || type === 'info') {
      this.playChime();
    } else if (type === 'warning' || type === 'error') {
      this.playAlertTone();
    }
  }

  /**
   * Masaüstü / Sistem bildirimi gönderir
   */
  public async sendDesktopNotification(title: string, body: string): Promise<void> {
    if (!('Notification' in window)) return;

    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: './assets/images/logo-bird.png',
          silent: true, // Sesi Web Audio ile kendimiz çaldığımız için çifte ses olmasın
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        // 6 saniye sonra otomatik kapat
        setTimeout(() => notif.close(), 6000);
      }
    } catch (e) {
      console.warn('[NotificationManager] Masaüstü bildirimi gönderilemedi:', e);
    }
  }

  /**
   * Model yanıtı tamamlandığında tetiklenir
   */
  public async notifyResponseCompletion(taskTitle: string = 'Yanıt Tamamlandı'): Promise<void> {
    try {
      const stored = localStorage.getItem('kraga-ide-settings');
      let notifyOnResponse = true;
      let notificationSound = true;

      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.notifyOnResponse !== undefined) notifyOnResponse = parsed.notifyOnResponse;
        if (parsed.notificationSound !== undefined) notificationSound = parsed.notificationSound;
      }

      // Ses çal
      if (notificationSound) {
        this.playChime();
      }

      // Pencere odakta değilse veya kullanıcı bildirimi istediyse masaüstü bildirimi fırlat
      if (notifyOnResponse) {
        const isFocused = document.hasFocus();
        if (!isFocused) {
          await this.sendDesktopNotification('Kraga AI', `Görevi tamamladı: ${taskTitle}`);
        }
      }
    } catch (e) {
      console.warn('[NotificationManager] Yanıt bildirimi hatası:', e);
    }
  }

  /**
   * Ayarlar penceresinde test amaçlı çağrılır
   */
  public async testNotification(): Promise<void> {
    this.playChime();
    await this.sendDesktopNotification('Kraga IDE • Bildirim Testi', 'Sesli ve görsel yanıt bildirimleri başarıyla çalışıyor!');
  }
}

export const notificationManager = NotificationManager.getInstance();
