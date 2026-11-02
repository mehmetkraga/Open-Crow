// src/ui/effects.ts
// Küçük etkileşim detayları: imleci izleyen ışık, tıklama noktasından yayılan ışık sızıntısı.
// Dar ekran kenar çubuğu ve bildirim şeridinin kapatılması da burada bağlanır.
// Görsel kurallar app.css ve detail.css'te; burada yalnızca konum bilgisi ve geçici sınıflar üretilir.

const SPOT = '.session-item, .suggestion, .new-chat, .side-footer, .workspace-btn';
const PRESS = '.composer, .send-btn, .new-chat, .btn-primary, .btn-ghost, .approval-actions button, .suggestion, .session-item';
// Basılma ışığı animasyonu 550ms; öğe bundan hemen sonra DOM'dan çıkarılır.
const PRESS_LIFETIME_MS = 560;
const NARROW_QUERY = '(max-width: 760px)';

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

  initNarrowSidebar();
  initNotice();
}

// ---------- Bildirim şeridi: × ve Escape ile kapanır ----------

function hideNotice(): void {
  const notice = document.getElementById('notice');
  if (!notice || notice.hidden) return;
  const hadFocus = notice.contains(document.activeElement);
  notice.hidden = true;
  if (hadFocus) document.getElementById('input')?.focus();
}

function initNotice(): void {
  document.getElementById('noticeClose')?.addEventListener('click', hideNotice);
  // Yakalama aşamasında dinlenir: ayarlar penceresi aynı Escape'te açıksa önce o kapanmasın diye
  // ayarlar açıkken bu dinleyici hiçbir şey yapmaz (main.ts kendi Escape'iyle kapatır).
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      if (!document.getElementById('settingsOverlay')?.hidden) return;
      if (document.querySelector('.app.is-sidebar-open')) return;
      hideNotice();
    },
    { capture: true },
  );
}

// ---------- Dar ekran: kenar çubuğu overlay olarak açılır ----------

function initNarrowSidebar(): void {
  const app = document.querySelector<HTMLElement>('.app');
  const sidebar = document.querySelector<HTMLElement>('.sidebar');
  const chat = document.querySelector<HTMLElement>('.chat');
  const toggle = document.getElementById('btnSidebarToggle');
  if (!app || !sidebar || !chat || !toggle) return;

  if (!sidebar.id) sidebar.id = 'sidebar';
  toggle.setAttribute('aria-controls', sidebar.id);
  const narrow = window.matchMedia(NARROW_QUERY);

  const isOpen = (): boolean => app.classList.contains('is-sidebar-open');

  const setOpen = (open: boolean, restoreFocus: boolean): void => {
    const next = open && narrow.matches;
    app.classList.toggle('is-sidebar-open', next);
    // Açıkken arkadaki sohbet alanı odak ve tıklamayı almaz
    chat.inert = next;
    toggle.setAttribute('aria-expanded', String(next));
    if (next) {
      sidebar.querySelector<HTMLElement>('.new-chat, .session-title')?.focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(!isOpen(), true));

  // Oturum seçilince ya da yeni sohbet / ayarlar açılınca overlay kapanır
  sidebar.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target?.closest('.session-title, #btnNewChat, #btnOpenSettings')) setOpen(false, false);
  });

  // Overlay dışına (kaplamaya) tıklanınca kapanır
  document.addEventListener('pointerdown', (event) => {
    if (!isOpen()) return;
    const target = event.target as Node | null;
    if (target && (sidebar.contains(target) || toggle.contains(target))) return;
    setOpen(false, false);
  });

  // Yakalama aşamasında: ayarlar penceresi açıksa dokunulmaz (main.ts kapatır)
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      if (!document.getElementById('settingsOverlay')?.hidden) return;
      setOpen(false, true);
    },
    { capture: true },
  );

  // Geniş ekrana geçince overlay durumu sıfırlanır
  narrow.addEventListener('change', (event) => {
    if (!event.matches) setOpen(false, false);
  });
}
