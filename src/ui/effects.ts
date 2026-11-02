// src/ui/effects.ts
// Küçük etkileşim detayları: imleci izleyen ışık, tıklama noktasından yayılan ışık sızıntısı.
// Görsel kurallar detail.css'te; burada yalnızca konum bilgisi ve geçici sınıflar üretilir.

const SPOT = '.session-item, .suggestion, .new-chat, .side-footer, .tool-head, .workspace-btn';
const PRESS = '.composer, .send-btn, .new-chat, .btn-primary, .btn-ghost, .approval-actions button, .suggestion, .session-item';
const PRESS_LIFETIME_MS = 720;

function pointInside(el: HTMLElement, e: PointerEvent): [number, number] {
  const rect = el.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

/** Tıklama noktasından yayılıp sönen bir ışık katmanı ekler. */
function spawnPressLight(host: HTMLElement, x: number, y: number): void {
  const light = document.createElement('span');
  light.className = 'press-light';
  light.style.setProperty('--px', `${x}px`);
  light.style.setProperty('--py', `${y}px`);
  host.appendChild(light);
  window.setTimeout(() => light.remove(), PRESS_LIFETIME_MS);
}

export function initEffects(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener(
    'pointermove',
    (event) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(SPOT);
      if (!el) return;
      const [x, y] = pointInside(el, event);
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    },
    { passive: true },
  );

  document.addEventListener('pointerdown', (event) => {
    if (reduceMotion) return;
    const el = (event.target as Element | null)?.closest<HTMLElement>(PRESS);
    if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
    const [x, y] = pointInside(el, event);
    el.style.setProperty('--px', `${x}px`);
    el.style.setProperty('--py', `${y}px`);
    spawnPressLight(el, x, y);
  });
}
