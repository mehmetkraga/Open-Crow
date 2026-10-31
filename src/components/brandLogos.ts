// src/components/brandLogos.ts
// Popüler platformlar ve servisler için orijinal, tam renkli (full-color) resmi vektörel SVG logoları

type SvgLogoFn = (size?: number) => string;

// 1. GitHub — Resmi Octocat Logosu
export const logoGitHub: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="12" fill="#24292e"/>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fill="#ffffff"/>
</svg>`;

// 2. PostgreSQL — Orijinal Slonik Fil Logosu (Resmi Kraliyet Mavisi)
export const logoPostgres: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#336791"/>
  <path d="M23.9 10c-7.2 0-13 4.8-13 11.2 0 4.1 2.4 7.7 6.1 9.6v4.8c0 .8.6 1.4 1.4 1.4h11c.8 0 1.4-.6 1.4-1.4v-4.8c3.7-1.9 6.1-5.5 6.1-9.6C36.9 14.8 31.1 10 23.9 10z" fill="#336791"/>
  <path d="M24 12c-6.1 0-11 4.5-11 10.2 0 3.5 1.8 6.5 4.6 8.3v4.5c0 .6.4 1 1 1h5.8c.6 0 1-.4 1-1v-4.5c2.8-1.8 4.6-4.8 4.6-8.3C35 16.5 30.1 12 24 12z" fill="#ffffff"/>
  <path d="M20.5 22.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm7 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" fill="#336791"/>
  <path d="M22 26c1 .8 3 .8 4 0" stroke="#336791" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M15 20c-1.5 0-3 1.5-3 3.5 0 2.5 2 4.5 4 4.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
  <path d="M33 20c1.5 0 3 1.5 3 3.5 0 2.5-2 4.5-4 4.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// 3. Slack — Orijinal 4 Renkli Resmi Hash Logosu
export const logoSlack: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1A1D21"/>
  <!-- Kırmızı Parçalar -->
  <path d="M14 26a3 3 0 110-6h6v6h-6z" fill="#E01E5A"/>
  <path d="M23 26a3 3 0 01-6 0V17a3 3 0 116 0v9z" fill="#E01E5A"/>
  <!-- Mavi Parçalar -->
  <path d="M26 14a3 3 0 01-6 0v-6a3 3 0 116 0v6z" fill="#36C5F0"/>
  <path d="M26 23a3 3 0 010-6h9a3 3 0 110 6h-9z" fill="#36C5F0"/>
  <!-- Yeşil Parçalar -->
  <path d="M34 22a3 3 0 110 6h-6v-6h6z" fill="#2EB67D"/>
  <path d="M25 22a3 3 0 016 0v9a3 3 0 11-6 0v-9z" fill="#2EB67D"/>
  <!-- Sarı Parçalar -->
  <path d="M22 34a3 3 0 016 0v6a3 3 0 11-6 0v-6z" fill="#ECB22E"/>
  <path d="M22 25a3 3 0 010 6h-9a3 3 0 110-6h9z" fill="#ECB22E"/>
</svg>`;

// 4. Discord — Orijinal Blurple Clyde Oyun Kolu Logosu
export const logoDiscord: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#5865F2"/>
  <path d="M34.8 15.6c-2.4-1.1-5-1.9-7.7-2.4-.3.6-.7 1.4-1 2-2.9-.4-5.8-.4-8.7 0-.3-.6-.7-1.4-1-2-2.7.5-5.3 1.3-7.7 2.4-4.8 7.2-6.1 14.2-5.5 21.1 3.2 2.4 6.3 3.8 9.4 4.8.8-1 1.4-2.1 2-3.3-1.1-.4-2.1-.9-3.1-1.6.3-.2.5-.4.8-.6 6.1 2.8 12.7 2.8 18.7 0 .3.2.5.4.8.6-1 .6-2.1 1.1-3.1 1.6.6 1.2 1.3 2.3 2 3.3 3.1-1 6.2-2.4 9.4-4.8.7-7.9-.9-14.8-5.6-21.1zM18.8 29.7c-1.9 0-3.4-1.7-3.4-3.8 0-2.1 1.5-3.8 3.4-3.8 1.9 0 3.5 1.7 3.4 3.8 0 2.1-1.5 3.8-3.4 3.8zm10.4 0c-1.9 0-3.4-1.7-3.4-3.8 0-2.1 1.5-3.8 3.4-3.8 1.9 0 3.5 1.7 3.4 3.8 0 2.1-1.5 3.8-3.4 3.8z" fill="#ffffff"/>
</svg>`;

// 5. Figma — Orijinal 5 Renkli Resmi Figma Logosu
export const logoFigma: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
  <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
  <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
  <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
  <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
</svg>`;

// 6. Docker — Orijinal Mavi Balina & Konteyner Logosu
export const logoDocker: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1D272B"/>
  <path d="M17 19h3.5v3.5H17V19zm4.5 0h3.5v3.5h-3.5V19zm4.5 0h3.5v3.5H26V19zm-9 4.5h3.5V27H17v-3.5zm4.5 0h3.5V27h-3.5v-3.5zm4.5 0h3.5V27H26v-3.5zm4.5 0h3.5V27h-3.5v-3.5zm-13.5 4.5h3.5V31H12.5v-3.5zm4.5 0H20.5V31H17v-3.5zm4.5 0H25V31h-3.5v-3.5zm4.5 0h3.5V31H26v-3.5zm4.5 0H34V31h-3.5v-3.5z" fill="#0db7ed"/>
  <path d="M40.5 28c-.8-.6-2.5-.8-4.2-.7-.1-2.7-1.8-5-4.2-6l-.8-.4-.6.7c-1.6 1.7-2.5 4-2.7 6.3-1.2.5-3.8.6-4.6.6H8.5c-.8 0-1.5.7-1.5 1.5 0 7.7 5.7 12 14.5 12 13.2 0 20.6-7.5 21.2-13.6 0-.2 0-.4 0-.5 0-.7-.7-1-2.2-1.4z" fill="#2496ed"/>
</svg>`;

// 7. AWS — Orijinal Turuncu Gülüş & Koyu Arka Plan Logosu
export const logoAWS: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#232F3E"/>
  <path d="M16 23.5c0-.6.1-1.1.2-1.5.2-.4.4-.8.7-1.2.1-.1.2-.2.3-.3.1 0 .2-.1.4-.1.2 0 .4.1.5.3l1.4 1.8c.1.1.2.3.2.4 0 .1 0 .2-.1.3-.3.4-.6.8-.7 1.2-.2.4-.3.9-.3 1.4 0 .8.2 1.4.7 1.9.5.5 1.1.7 2 .7.6 0 1.2-.2 1.8-.5.6-.3 1.2-.8 1.8-1.4v-6.3c0-.3.1-.5.2-.7.1-.2.4-.3.8-.3h2.3c.3 0 .5.1.7.3.2.2.3.4.3.7v10.4c0 .3-.1.5-.2.7-.1.2-.4.3-.7.3h-2.1c-.3 0-.5-.1-.7-.3-.1-.2-.2-.4-.2-.7v-1.1c-.8.8-1.7 1.4-2.6 1.8-.9.4-1.9.6-3 .6-1.6 0-2.8-.5-3.8-1.5-1-1-1.5-2.3-1.5-3.9z" fill="#ffffff"/>
  <!-- Turuncu AWS Oku (Gülüş) -->
  <path d="M12 33.5c7.3 4.2 16.7 4.2 24 0" stroke="#FF9900" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M37 32l1 3.5-3.5-.5" stroke="#FF9900" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// 8. Brave Search — Orijinal Canlı Turuncu/Kırmızı Cesur Aslan Logosu
export const logoBrave: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1B1C21"/>
  <path d="M24 10l5 5.5 7.5-.5-2.5 8 4 6.5-6.5 4.5.5 7.5-8-2.5-8 2.5.5-7.5-6.5-4.5 4-6.5-2.5-8 7.5.5L24 10z" fill="url(#braveGrad)"/>
  <path d="M24 14l3.5 4 5-.5-1.5 5.5 3 4.5-4.5 3 .5 5.5-6-2-6 2 .5-5.5-4.5-3 3-4.5-1.5-5.5 5 .5L24 14z" fill="#ffffff"/>
  <defs>
    <linearGradient id="braveGrad" x1="12" y1="10" x2="36" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF3B00"/>
      <stop offset="1" stop-color="#FF7A00"/>
    </linearGradient>
  </defs>
</svg>`;

// 9. Google Stitch / Google Drive — Orijinal 4 Renkli Google 'G' Logosu
export const logoGoogle: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#ffffff"/>
  <path d="M35.6 24.5c0-.8-.1-1.6-.2-2.5H24v4.7h6.6c-.3 1.5-1.1 2.8-2.4 3.7v3h3.8c2.2-2 3.6-5 3.6-8.9z" fill="#4285F4"/>
  <path d="M24 36.3c3.3 0 6.1-1.1 8.2-3l-3.8-3c-1.1.8-2.6 1.2-4.4 1.2-3.3 0-6.1-2.2-7.1-5.3H13v3.1c2.1 4.2 6.5 7 11 7z" fill="#34A853"/>
  <path d="M16.9 26.2c-.3-.8-.4-1.7-.4-2.6s.1-1.8.4-2.6V18h-3.9C12.1 20 11.5 22.4 11.5 25s.6 5 1.5 7l3.9-3.1v-2.7z" fill="#FBBC05"/>
  <path d="M24 13.7c1.8 0 3.4.6 4.7 1.8l3.5-3.5C30.1 10.1 27.3 9 24 9c-4.5 0-8.9 2.8-11 7l3.9 3.1c1-3.1 3.8-5.4 7.1-5.4z" fill="#EA4335"/>
</svg>`;

// 10. Google Stitch MCP — Özel Stitch UI Logosu
export const logoStitch: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1F1F1F"/>
  <circle cx="24" cy="24" r="14" stroke="url(#stitchGrad)" stroke-width="3"/>
  <path d="M18 24h12M24 18v12" stroke="url(#stitchGrad)" stroke-width="3" stroke-linecap="round"/>
  <defs>
    <linearGradient id="stitchGrad" x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4285F4"/>
      <stop offset="0.33" stop-color="#EA4335"/>
      <stop offset="0.66" stop-color="#FBBC05"/>
      <stop offset="1" stop-color="#34A853"/>
    </linearGradient>
  </defs>
</svg>`;

// 11. Linear — Orijinal Geometrik Mor Gradient Logosu
export const logoLinear: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#121316"/>
  <path d="M14.5 33.5c-4.7-4.7-4.7-12.3 0-17l19 19c-4.7 4.7-12.3 4.7-19-2z" fill="#5E6AD2"/>
  <path d="M17.5 13.5l17 17c3.9-3.9 3.9-10.1 0-14s-10.1-3.9-14 0l-3-3z" fill="#8892EC"/>
</svg>`;

// 12. Sentry — Orijinal Kırmızı/Neon Teşhis Sarmalı Logosu
export const logoSentry: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#362D59"/>
  <path d="M26.2 12c-1.3 0-2.6.4-3.6 1.2L12.5 21c-1.6 1.3-2.5 3.3-2.5 5.4 0 2.1.9 4.1 2.5 5.4l10.1 7.8c1 .8 2.3 1.2 3.6 1.2 1.3 0 2.6-.4 3.6-1.2l10.1-7.8c1.6-1.3 2.5-3.3 2.5-5.4 0-2.1-.9-4.1-2.5-5.4l-10.1-7.8c-1-.8-2.3-1.2-3.6-1.2z" fill="#FF4565"/>
  <path d="M25 18l6 5v6l-6 5-6-5v-6l6-5z" fill="#ffffff"/>
</svg>`;

// 13. Puppeteer — Orijinal Tilki & Kukla İpleri Logosu
export const logoPuppeteer: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C2128"/>
  <circle cx="18" cy="18" r="4" fill="#00D8A2"/>
  <circle cx="30" cy="18" r="4" fill="#00D8A2"/>
  <path d="M18 22v12M30 22v12" stroke="#40B5A6" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="14" y="32" width="20" height="4" rx="2" fill="#00D8A2"/>
</svg>`;

// 14. Sequential Thinking — Orijinal Neon Nöron Ağı Logosu
export const logoSequentialThinking: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0F111A"/>
  <circle cx="16" cy="24" r="5" fill="#00F0FF"/>
  <circle cx="32" cy="16" r="4" fill="#B44DFF"/>
  <circle cx="32" cy="32" r="4" fill="#FF2D78"/>
  <path d="M20 22l9-4M20 26l9 4" stroke="#ffffff" stroke-width="2" stroke-dasharray="3 3"/>
</svg>`;

// 15. Python — Orijinal Mavi & Sarı Yılan Logosu
export const logoPython: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1E232A"/>
  <path d="M23.6 11c-5.8 0-5.5 2.5-5.5 2.5l.02 2.6h5.6v.8h-7.8c-2.4 0-4.2 1.4-4.2 4.2 0 2.8 1.6 4.3 4.2 4.3h2.5v-3.5c0-2.8 2.4-5.2 5.2-5.2h5.5v-2.6c0-2.3-2.1-3.1-5.5-3.1zm-1.8 1.7a1 1 0 110 2 1 1 0 010-2z" fill="#387EB8"/>
  <path d="M24.4 37c5.8 0 5.5-2.5 5.5-2.5l-.02-2.6h-5.6v-.8h7.8c2.4 0 4.2-1.4 4.2-4.2 0-2.8-1.6-4.3-4.2-4.3h-2.5v3.5c0 2.8-2.4 5.2-5.2 5.2h-5.5v2.6c0 2.3 2.1 3.1 5.5 3.1zm1.8-1.7a1 1 0 110-2 1 1 0 010 2z" fill="#FFE052"/>
</svg>`;

// 16. Supabase — Orijinal Neon Yeşil Şimşek Logosu
export const logoSupabase: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C1C1C"/>
  <path d="M25.4 37.8c-.8.9-2.2.4-2.3-.8L21.8 25H13.6c-1.3 0-2-1.6-1.1-2.5l11-13.1c.8-.9 2.2-.4 2.3.8l1.3 11.8h8.2c1.3 0 2 1.6 1.1 2.5l-11 13.3z" fill="#3ECF8E"/>
</svg>`;

// 17. Blender 3D — Resmi Turuncu & Mavi Pervane Logosu
export const logoBlender: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C2026"/>
  <path d="M23.5 10c-.8 0-1.5.7-1.5 1.5v5.2c-5.7.7-10.2 5.2-10.9 10.9L7.3 26.5c-.8.5-1 1.6-.5 2.4.5.8 1.6 1 2.4.5l4.3-2.5c1.4 5.2 5.7 9.2 11 9.9l1.6 4.7c.3.8 1.2 1.3 2 1 .8-.3 1.3-1.2 1-2l-1.6-4.7c5.8-.8 10.3-5.5 10.9-11.4l4.6 2.7c.8.5 1.9.2 2.4-.6.5-.8.2-1.9-.6-2.4l-4.5-2.6c-.7-5.9-5.3-10.7-11.2-11.4V11.5c0-.8-.7-1.5-1.5-1.5z" fill="#F5792A"/>
  <circle cx="25" cy="27" r="7" fill="#265787"/>
  <circle cx="25" cy="27" r="3.2" fill="#FFFFFF"/>
</svg>`;

// 18. Unreal Engine 5 — Resmi Beyaz 'U' Dairesel Amblemi
export const logoUnreal: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0E1128"/>
  <circle cx="24" cy="24" r="16" stroke="#00f0ff" stroke-width="1.8" stroke-opacity="0.6"/>
  <path d="M24 12c-6.6 0-12 5.4-12 12 0 6.6 5.4 12 12 12s12-5.4 12-12c0-6.6-5.4-12-12-12zm-3.8 7.5h2.4v7.4c0 1.2.6 1.9 1.4 1.9.8 0 1.4-.7 1.4-1.9v-7.4h2.4v7.5c0 2.6-1.6 4.1-3.8 4.1-2.2 0-3.8-1.5-3.8-4.1v-7.5z" fill="#FFFFFF"/>
  <path d="M16 24c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8zm2.2 0c0 3.2 2.6 5.8 5.8 5.8s5.8-2.6 5.8-5.8-2.6-5.8-5.8-5.8-5.8 2.6-5.8 5.8z" fill="#FFFFFF" fill-opacity="0.15"/>
</svg>`;

// 19. Unity Engine — Resmi 3 Eksenli İzometrik Küp Logosu
export const logoUnity: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#222C37"/>
  <path d="M24 10l-12 7v14l12 7 12-7V17L24 10zm-1.5 4.3v6.8l-5.9 3.4-3.5-6.1 9.4-4.1zm3 0l9.4 4.1-3.5 6.1-5.9-3.4v-6.8zm-11.4 12l5.9 3.4v6.8l-9.4-4.1 3.5-6.1zm19.8 0l3.5 6.1-9.4 4.1v-6.8l5.9-3.4zm-9.9-1.2l4.8-2.8 4.8 2.8v5.5l-4.8 2.8-4.8-2.8v-5.5z" fill="#FFFFFF"/>
</svg>`;

// 20. Godot Engine — Resmi Sevimli Robot Logosu
export const logoGodot: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#18212E"/>
  <path d="M24 10c-1.1 0-2 .9-2 2v2.2C16 15 11 19.5 11 25.5v7c0 1.9 1.6 3.5 3.5 3.5h19c1.9 0 3.5-1.6 3.5-3.5v-7c0-6-5-10.5-11-11.3V12c0-1.1-.9-2-2-2z" fill="#478CBF"/>
  <rect x="22" y="8" width="4" height="4" rx="1" fill="#478CBF"/>
  <rect x="9" y="24" width="4" height="6" rx="1" fill="#478CBF"/>
  <rect x="35" y="24" width="4" height="6" rx="1" fill="#478CBF"/>
  <circle cx="18.5" cy="25" r="4.5" fill="#FFFFFF"/>
  <circle cx="29.5" cy="25" r="4.5" fill="#FFFFFF"/>
  <circle cx="19.5" cy="25" r="2.2" fill="#202531"/>
  <circle cx="28.5" cy="25" r="2.2" fill="#202531"/>
  <path d="M20 31h8c.6 0 1 .4 1 1v1c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-1c0-.6.4-1 1-1z" fill="#202531"/>
  <rect x="22.5" y="31" width="3" height="2" fill="#FFFFFF"/>
</svg>`;

// 21. GitLab — Resmi Turuncu & Kırmızı Tilki Logosu
export const logoGitLab: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#292961"/>
  <path d="M24 38l7-21.5H17L24 38z" fill="#E24329"/>
  <path d="M24 38l-7-21.5h-8.8L24 38z" fill="#FC6D26"/>
  <path d="M8.2 16.5L6.6 21.4c-.4 1.2 0 2.5 1 3.2L24 38 8.2 16.5z" fill="#FCA326"/>
  <path d="M8.2 16.5h8.8l-3.8-11.7c-.4-1.3-2.3-1.3-2.8 0L8.2 16.5z" fill="#E24329"/>
  <path d="M24 38l7-21.5h8.8L24 38z" fill="#FC6D26"/>
  <path d="M39.8 16.5l1.6 4.9c.4 1.2 0 2.5-1 3.2L24 38l15.8-21.5z" fill="#FCA326"/>
  <path d="M39.8 16.5H31l3.8-11.7c.4-1.3 2.3-1.3 2.8 0l2.2 11.7z" fill="#E24329"/>
</svg>`;

// 22. Git — Resmi Turuncu Baklava Logosu
export const logoGit: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#24292E"/>
  <path d="M36.4 21.6L26.4 11.6a2.8 2.8 0 00-4 0l-10.8 10.8a2.8 2.8 0 000 4l10 10a2.8 2.8 0 004 0l10.8-10.8a2.8 2.8 0 000-4z" fill="#F05032"/>
  <circle cx="28" cy="24" r="2.2" fill="#FFFFFF"/>
  <circle cx="20" cy="20" r="2.2" fill="#FFFFFF"/>
  <circle cx="20" cy="28" r="2.2" fill="#FFFFFF"/>
  <path d="M20 22v4M22 21l4 2.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

// 23. Bitbucket — Resmi Mavi Kova Logosu
export const logoBitbucket: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0E1A2F"/>
  <path d="M12 14h24l-3.2 20H15.2L12 14z" fill="#2684FF"/>
  <path d="M21.2 26h5.6l1-7h-7.6l1 7z" fill="#FFFFFF"/>
</svg>`;

// 24. SQLite — Mavi Tüy & Veritabanı Kutusu Logosu
export const logoSQLite: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#003B57"/>
  <path d="M14 16c0-2.2 4.5-4 10-4s10 1.8 10 4v16c0 2.2-4.5 4-10 4s-10-1.8-10-4V16z" fill="#00758F"/>
  <ellipse cx="24" cy="16" rx="10" ry="4" fill="#00A3CC"/>
  <path d="M14 24c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#003B57" stroke-width="2"/>
  <path d="M14 28c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#003B57" stroke-width="2"/>
  <path d="M20 20l8 8M28 20l-8 8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// 25. MySQL — Turuncu/Mavi Yunus Logosu
export const logoMySQL: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#005A70"/>
  <path d="M34 16c-3-2-8-3-12-1-5 2-8 7-8 12 0 4 2 8 6 9 3 1 7 0 9-2 2-2 3-5 3-8 0-3-1-6-3-8l5-2z" fill="#00758F"/>
  <path d="M30 18c1 3 0 7-2 9-2 2-5 2-7 1-3-1-4-4-4-7 0-4 3-7 7-8 2 0 4 1 6 5z" fill="#F29111"/>
  <circle cx="23" cy="20" r="1.5" fill="#FFFFFF"/>
</svg>`;

// 26. MongoDB — Yeşil Yaprak Logosu
export const logoMongoDB: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#111B15"/>
  <path d="M24 10s-9 6.5-9 15.5c0 7 6.5 11 9 12.5 2.5-1.5 9-5.5 9-12.5C33 16.5 24 10 24 10z" fill="#13AA52"/>
  <path d="M24 10v28c.5 0 9-5.5 9-12.5C33 16.5 24 10 24 10z" fill="#00ED64"/>
  <path d="M24 38c-.3-.2-1-2-1-3.5 0-3 1-5 1-5s1 2 1 5c0 1.5-.7 3.3-1 3.5z" fill="#FFFFFF"/>
</svg>`;

// 27. Redis — Canlı Kırmızı Küp & Katman Logosu
export const logoRedis: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1F1515"/>
  <path d="M24 12l14 6-14 6-14-6 14-6z" fill="#D82C20"/>
  <path d="M10 22l14 6 14-6v6l-14 6-14-6v-6z" fill="#A81D13"/>
  <path d="M10 30l14 6 14-6v6l-14 6-14-6v-6z" fill="#7E150D"/>
  <path d="M21 16l6 2.5M21 18l6 2.5" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

// 28. Neo4j — Grafik Veritabanı Ağ Logosu
export const logoNeo4j: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0A1C30"/>
  <line x1="16" y1="16" x2="32" y2="20" stroke="#008CC1" stroke-width="2.5"/>
  <line x1="16" y1="16" x2="22" y2="34" stroke="#008CC1" stroke-width="2.5"/>
  <line x1="32" y1="20" x2="34" y2="32" stroke="#008CC1" stroke-width="2.5"/>
  <line x1="22" y1="34" x2="34" y2="32" stroke="#008CC1" stroke-width="2.5"/>
  <circle cx="16" cy="16" r="5" fill="#008CC1"/>
  <circle cx="32" cy="20" r="4.5" fill="#015B7E"/>
  <circle cx="22" cy="34" r="5.5" fill="#42C1F5"/>
  <circle cx="34" cy="32" r="4" fill="#008CC1"/>
</svg>`;

// 29. Snowflake — Kar Tanesi Mavi Logosu
export const logoSnowflake: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0E2135"/>
  <path d="M24 10v28M12 18l24 12M12 30l24-12" stroke="#29B5E8" stroke-width="3" stroke-linecap="round"/>
  <path d="M21 13l3-3 3 3M21 35l3 3 3-3M13 21l-3-3 3-3M35 21l3-3-3-3" stroke="#29B5E8" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// 30. Pinecone — Vektör Çam Ağacı Logosu
export const logoPinecone: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#051C14"/>
  <path d="M24 10l-8 10h5l-6 9h6l-7 10h20l-7-10h6l-6-9h5l-8-10z" fill="#00D26A"/>
  <circle cx="24" cy="24" r="2.5" fill="#FFFFFF"/>
</svg>`;

// 31. Qdrant — Hedef Vektör Logosu
export const logoQdrant: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C1826"/>
  <circle cx="24" cy="24" r="14" stroke="#DC2626" stroke-width="3"/>
  <circle cx="24" cy="24" r="9" stroke="#3B82F6" stroke-width="2.5"/>
  <circle cx="24" cy="24" r="4" fill="#DC2626"/>
</svg>`;

// 32. ChromaDB — Renkli Halka Logosu
export const logoChroma: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#111116"/>
  <circle cx="24" cy="24" r="12" stroke="#FF5722" stroke-width="3"/>
  <circle cx="20" cy="20" r="5" fill="#4CAF50"/>
  <circle cx="28" cy="22" r="4" fill="#2196F3"/>
  <circle cx="23" cy="28" r="4.5" fill="#FFC107"/>
</svg>`;

// 33. Elasticsearch — 4 Renkli Analitik Logosu
export const logoElasticsearch: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1E272C"/>
  <path d="M24 14a10 10 0 0110 10h-20a10 10 0 0110-10z" fill="#005571"/>
  <path d="M24 34a10 10 0 01-10-10h20a10 10 0 01-10 10z" fill="#00BFB3"/>
  <rect x="14" y="22" width="20" height="4" fill="#FED136"/>
</svg>`;

// 34. ClickHouse — Sarı/Turuncu Veri Çubukları Logosu
export const logoClickHouse: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#262214"/>
  <rect x="13" y="16" width="3.5" height="16" rx="1.5" fill="#FFCC00"/>
  <rect x="18.5" y="12" width="3.5" height="24" rx="1.5" fill="#FF9900"/>
  <rect x="24" y="20" width="3.5" height="16" rx="1.5" fill="#FF6600"/>
  <rect x="29.5" y="14" width="3.5" height="22" rx="1.5" fill="#FF3300"/>
</svg>`;

// 35. Kubernetes — Dümen Simidi Mavi Logosu
export const logoKubernetes: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1B264F"/>
  <circle cx="24" cy="24" r="13" stroke="#326CE5" stroke-width="3"/>
  <circle cx="24" cy="24" r="4.5" fill="#326CE5"/>
  <path d="M24 11v5M24 32v5M11 24h5M32 24h5M15 15l3.5 3.5M29.5 29.5L33 33M15 33l3.5-3.5M29.5 18.5L33 15" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

// 36. Cloudflare — Orijinal Turuncu Bulut Logosu
export const logoCloudflare: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#201A15"/>
  <path d="M31.5 21a6.5 6.5 0 00-6.4 5.5A4.5 4.5 0 0021 26a4.5 4.5 0 00-4.3 3.3A3.5 3.5 0 0014 32.5c0 2 1.5 3.5 3.5 3.5h18c2.5 0 4.5-2 4.5-4.5 0-2.3-1.8-4.2-4.1-4.5A6.5 6.5 0 0031.5 21z" fill="#F38020"/>
  <path d="M33 36h2.5c2 0 3.5-1.5 3.5-3.5 0-1.8-1.3-3.2-3.1-3.5l-.9-.1-.2-.9c-.6-3.2-3.3-5.5-6.6-5.5-2 0-3.8.8-5.1 2.2l1.5 1.5c1-1 2.3-1.6 3.6-1.6 2.3 0 4.3 1.6 4.7 3.9l.4 2.2 2.2.3c1.2.2 2.1 1.2 2.1 2.5 0 1.4-1.1 2.5-2.5 2.5H33v.5z" fill="#FAAD3F"/>
</svg>`;

// 37. Microsoft Azure — Mavi Kristal Bulut Logosu
export const logoAzure: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0E1A2B"/>
  <path d="M14 34l8.5-22h7.8L19.2 34H14z" fill="#0078D4"/>
  <path d="M23.5 23l4.2-6.5L34 34H21.5l2-11z" fill="#50E6FF"/>
</svg>`;

// 38. Google Cloud Platform (GCP) — 4 Renkli Bulut Logosu
export const logoGCP: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1A1F2C"/>
  <path d="M29 18a7 7 0 00-6.8 5.4A5 5 0 0018 23a5 5 0 00-4.8 3.7A4 4 0 0011 30.5c0 2.2 1.8 4 4 4h18c3 0 5.5-2.5 5.5-5.5 0-2.8-2.1-5.1-4.9-5.4A7 7 0 0029 18z" fill="#4285F4"/>
  <circle cx="21" cy="27" r="3" fill="#EA4335"/>
  <circle cx="28" cy="24" r="3.5" fill="#FBBC05"/>
  <circle cx="29" cy="30" r="3" fill="#34A853"/>
</svg>`;

// 39. Vercel — Siyah & Beyaz Üçgen Logosu
export const logoVercel: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#000000"/>
  <path d="M24 13L36 34H12L24 13z" fill="#FFFFFF"/>
</svg>`;

// 40. Datadog — Sevimli Köpek & Grafikler Logosu
export const logoDatadog: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#241433"/>
  <path d="M16 28c0-5.5 4.5-10 10-10 2.5 0 4.8.9 6.5 2.5l-2.5 2.5A6.5 6.5 0 0026 21.5c-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5c1.8 0 3.4-.7 4.5-1.9l2.5 2.5A10 10 0 0126 38c-5.5 0-10-4.5-10-10z" fill="#632CA6"/>
  <circle cx="28" cy="18" r="3.5" fill="#9B51E0"/>
  <circle cx="34" cy="24" r="2.5" fill="#9B51E0"/>
</svg>`;

// 41. Tavily AI Search — Mor Araştırma Büyüteci Logosu
export const logoTavily: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1A132B"/>
  <circle cx="22" cy="22" r="9" stroke="#9061F9" stroke-width="3"/>
  <path d="M29 29l7 7" stroke="#C27803" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M22 17v10M17 22h10" stroke="#9061F9" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// 42. Exa Semantic Search — Neon Yeşil Altıgen Logosu
export const logoExa: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0C1B14"/>
  <path d="M24 12l10 6v12l-10 6-10-6V18l10-6z" stroke="#00FF88" stroke-width="2.5"/>
  <circle cx="24" cy="24" r="4" fill="#00FF88"/>
</svg>`;

// 43. Perplexity AI Search — Teal Yıldız Asterisk Logosu
export const logoPerplexity: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0B2024"/>
  <path d="M24 10v28M10 24h28M14 14l20 20M14 34L34 14" stroke="#20B2AA" stroke-width="3" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="4.5" fill="#20B2AA"/>
</svg>`;

// 44. Playwright — Yeşil & Kırmızı Tiyatro Maskesi Logosu
export const logoPlaywright: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C2128"/>
  <circle cx="20" cy="22" r="7" fill="#2EAD33"/>
  <circle cx="28" cy="26" r="7" fill="#E53935"/>
  <circle cx="20" cy="22" r="2.5" fill="#FFFFFF"/>
  <circle cx="28" cy="26" r="2.5" fill="#FFFFFF"/>
</svg>`;

// 45. Firecrawl — Alev & Web Tarayıcı Logosu
export const logoFirecrawl: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#24130D"/>
  <path d="M24 10c0 5-4 8-4 13 0 4.4 3.6 8 8 8s8-3.6 8-8c0-7-7-10-7-13 0 0-1 4-3 4-2 0-2-4-2-4z" fill="#FF5722"/>
  <path d="M24 22c0 3-2 5-2 8 0 2.2 1.8 4 4 4s4-1.8 4-4c0-3.5-3.5-5-3.5-7 0 0-.5 2-1.5 2-1 0-1-3-1-3z" fill="#FFC107"/>
</svg>`;

// 46. Web Fetcher — Dünya & Ağ Logosu
export const logoFetch: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0E232E"/>
  <circle cx="24" cy="24" r="13" stroke="#00BCD4" stroke-width="2.5"/>
  <ellipse cx="24" cy="24" rx="6" ry="13" stroke="#00BCD4" stroke-width="2"/>
  <line x1="11" y1="24" x2="37" y2="24" stroke="#00BCD4" stroke-width="2"/>
</svg>`;

// 47. Notion — Siyah/Beyaz 'N' Logosu
export const logoNotion: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#FFFFFF"/>
  <path d="M14 13l14-2v24l-14 2V13z" fill="#000000"/>
  <path d="M19 16v14l10-12v14" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// 48. Jira — Mavi Atlassian Elması Logosu
export const logoJira: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0A1E3F"/>
  <path d="M24 12l8 8-8 8-8-8 8-8z" fill="#0052CC"/>
  <path d="M24 20l8 8-8 8-8-8 8-8z" fill="#2684FF"/>
</svg>`;

// 49. Confluence — Mavi Dalgalar Logosu
export const logoConfluence: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#091A33"/>
  <path d="M15 28c0-5 6-7 10-9l-3 6c-3 1-5 2-5 3h16c0 5-6 7-10 9l3-6c3-1 5-2 5-3H15z" fill="#2684FF"/>
</svg>`;

// 50. Asana — 3 Kırmızı Mercan Dairesi Logosu
export const logoAsana: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#29151B"/>
  <circle cx="24" cy="18" r="5" fill="#F06A6A"/>
  <circle cx="17" cy="29" r="5" fill="#F06A6A"/>
  <circle cx="31" cy="29" r="5" fill="#F06A6A"/>
</svg>`;

// 51. Todoist — Kırmızı 3 Tik İşareti Logosu
export const logoTodoist: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#261012"/>
  <path d="M15 17l4 4 10-10M15 24l4 4 10-10M15 31l4 4 10-10" stroke="#E44332" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// 52. Obsidian — Mor Kristal Cevher Logosu
export const logoObsidian: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#181124"/>
  <path d="M24 10l8 6-3 18-9 4-6-9 2-13 8-6z" fill="#7C3AED"/>
  <path d="M24 10l5 12-5 16-3-14 3-14z" fill="#A78BFA"/>
</svg>`;

// 53. Telegram — Mavi Kağıt Uçak Logosu
export const logoTelegram: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#2AABEE"/>
  <path d="M35 15L13 23.5l6.5 2.5 10-6.5-7.5 7.5L31 32l4-17z" fill="#FFFFFF"/>
</svg>`;

// 54. WhatsApp — Yeşil Konuşma Balonu Logosu
export const logoWhatsApp: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#12251D"/>
  <circle cx="24" cy="24" r="13" fill="#25D366"/>
  <path d="M20 18c-.4 0-.8.1-1.1.6-.4.5-1.4 1.4-1.4 3.4 0 2 1.5 3.9 1.7 4.1.2.3 2.8 4.3 6.9 6 3.4 1.4 4.1 1.1 4.8 1.1.7-.1 2.3-1 2.6-1.9.4-.9.4-1.7.3-1.9-.1-.2-.4-.3-.9-.6s-2.8-1.4-3.2-1.5c-.4-.2-.8-.3-1.1.3-.4.5-1.4 1.8-1.7 2.1-.3.4-.6.4-1.1.2-.5-.3-2.2-.8-4.2-2.6-1.5-1.4-2.6-3.1-2.9-3.6-.3-.5 0-.8.2-1 .2-.2.5-.6.8-.9.2-.3.3-.6.5-.9.2-.4.1-.7 0-.9s-1.1-2.7-1.5-3.7c-.4-1-.8-.8-1.1-.8z" fill="#FFFFFF"/>
</svg>`;

// 55. Stripe — Mor 'S' Logosu
export const logoStripe: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#635BFF"/>
  <path d="M24 16c-3.5 0-5.5 1.5-5.5 4 0 4.5 6.5 3.8 6.5 6 0 1-.9 1.5-2.2 1.5-1.8 0-3.6-.8-4.8-1.8v3.5c1.4.8 3.2 1.2 5 1.2 3.8 0 5.8-1.6 5.8-4.2 0-4.8-6.5-4-6.5-6.1 0-.9.8-1.4 2-1.4 1.5 0 3 .6 4.1 1.4v-3.2c-1.3-.6-2.8-.9-4.4-.9z" fill="#FFFFFF"/>
</svg>`;

// 56. Airtable — Renkli Bloklar Logosu
export const logoAirtable: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#171A21"/>
  <path d="M24 12l10 5.5-10 5.5-10-5.5 10-5.5z" fill="#FCB400"/>
  <path d="M25 24.5v11.5l8-4.5V20l-8 4.5z" fill="#18BFFF"/>
  <path d="M23 24.5v11.5l-8-4.5V20l8 4.5z" fill="#ED3F53"/>
</svg>`;

// 57. Twilio — Kırmızı Daire & 4 Beyaz Nokta Logosu
export const logoTwilio: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#241113"/>
  <circle cx="24" cy="24" r="13" fill="#F22F46"/>
  <circle cx="19" cy="19" r="2.5" fill="#FFFFFF"/>
  <circle cx="29" cy="19" r="2.5" fill="#FFFFFF"/>
  <circle cx="19" cy="29" r="2.5" fill="#FFFFFF"/>
  <circle cx="29" cy="29" r="2.5" fill="#FFFFFF"/>
</svg>`;

// 58. SendGrid — Mavi Izgara Kutusu Logosu
export const logoSendGrid: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0D2136"/>
  <rect x="14" y="14" width="8" height="8" rx="2" fill="#009DD9"/>
  <rect x="26" y="14" width="8" height="8" rx="2" fill="#1A82E2"/>
  <rect x="14" y="26" width="8" height="8" rx="2" fill="#00B3EC"/>
  <rect x="26" y="26" width="8" height="8" rx="2" fill="#2056AE"/>
</svg>`;

// 59. Zapier — Turuncu Yıldız Logosu
export const logoZapier: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#FF4F00"/>
  <path d="M24 13v22M13 24h22M16 16l16 16M16 32l16-16" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
</svg>`;

// 60. Google Maps — Kırmızı Pin & Renkli Harita Logosu
export const logoGoogleMaps: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1C2128"/>
  <path d="M24 11c-5 0-9 4-9 9 0 7 9 17 9 17s9-10 9-17c0-5-4-9-9-9z" fill="#EA4335"/>
  <circle cx="24" cy="20" r="3.5" fill="#FFFFFF"/>
</svg>`;

// 61. Meshy 3D — Neon 3D Küp Logosu
export const logoMeshy: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#111827"/>
  <path d="M24 11l12 7v14l-12 7-12-7V18l12-7z" stroke="#00F0FF" stroke-width="2.5"/>
  <path d="M24 11v28M12 18l24 14M36 18L12 32" stroke="#7C3AED" stroke-width="1.8"/>
  <circle cx="24" cy="24" r="3" fill="#00F0FF"/>
</svg>`;

// 62. Replicate — Siyah & Beyaz 'R' Logosu
export const logoReplicate: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#000000"/>
  <path d="M14 14h12c4.4 0 8 3.6 8 8 0 3.8-2.6 6.9-6.2 7.7L34 36h-5.5l-5.5-6H19v6h-5V14zm5 11h7c1.7 0 3-1.3 3-3s-1.3-3-3-3h-7v6z" fill="#FFFFFF"/>
</svg>`;

// 63. ElevenLabs — 2 Dikey Çubuk Ses Logosu
export const logoElevenLabs: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#000000"/>
  <rect x="18" y="12" width="4" height="24" rx="2" fill="#FFFFFF"/>
  <rect x="26" y="12" width="4" height="24" rx="2" fill="#FFFFFF"/>
</svg>`;

// 64. Hugging Face — Sarı Sevimli Emoji Logosu
export const logoHuggingFace: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#242111"/>
  <circle cx="24" cy="24" r="14" fill="#FFD21E"/>
  <ellipse cx="19" cy="22" rx="2" ry="3" fill="#000000"/>
  <ellipse cx="29" cy="22" rx="2" ry="3" fill="#000000"/>
  <path d="M19 28c2 3 8 3 10 0" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// 65. npm — Resmi Kırmızı Kutu Logosu
export const logoNpm: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#CB3837"/>
  <path d="M14 17h20v14H24v-9h-5v9h-5V17z" fill="#FFFFFF"/>
</svg>`;

// 66. Memory & Knowledge Graph — Neon Ağ Logosu
export const logoMemory: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#141126"/>
  <line x1="16" y1="20" x2="28" y2="15" stroke="#A855F7" stroke-width="2"/>
  <line x1="28" y1="15" x2="34" y2="26" stroke="#A855F7" stroke-width="2"/>
  <line x1="16" y1="20" x2="22" y2="33" stroke="#A855F7" stroke-width="2"/>
  <line x1="22" y1="33" x2="34" y2="26" stroke="#A855F7" stroke-width="2"/>
  <circle cx="16" cy="20" r="4.5" fill="#3B82F6"/>
  <circle cx="28" cy="15" r="4" fill="#A855F7"/>
  <circle cx="34" cy="26" r="4.5" fill="#EC4899"/>
  <circle cx="22" cy="33" r="5" fill="#06B6D4"/>
</svg>`;

// 67. Local Filesystem — Klasör & Güvenli Dosya Logosu
export const logoFilesystem: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#1A202C"/>
  <path d="M12 16a2 2 0 012-2h6l3 3h11a2 2 0 012 2v13a2 2 0 01-2 2H14a2 2 0 01-2-2V16z" fill="#4A5568"/>
  <path d="M12 20h24v12a2 2 0 01-2 2H14a2 2 0 01-2-2V20z" fill="#ED8936"/>
</svg>`;

// 68. World Time — Saat & Zaman Dilimi Logosu
export const logoTime: SvgLogoFn = (s = 28) => `
<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#0F172A"/>
  <circle cx="24" cy="24" r="13" stroke="#38BDF8" stroke-width="2.5"/>
  <path d="M24 16v8l5 4" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;


