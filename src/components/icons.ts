// src/components/icons.ts
// Merkezi SVG ikon kütüphanesi — Lucide/Feather tarzı stroke-based ikonlar
// Tüm ikonlar 24x24 viewBox, currentColor, 2px stroke

type IconFn = (size?: number, color?: string) => string;

const svg = (size: number, color: string, content: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

// ─── Activity Bar ────────────────────────────────────────────────
export const iconFiles: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>');

export const iconSearch: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>');

export const iconGitBranch: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>');

export const iconExtensions: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/>');

export const iconSettings: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>');

export const iconUser: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');

// ─── Dosya Ağacı ─────────────────────────────────────────────────
export const iconFolder: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>');

export const iconFolderOpen: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>');

export const iconChevronRight: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m9 18 6-6-6-6"/>');

export const iconChevronDown: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m6 9 6 6 6-6"/>');

export const iconChevronLeft: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m15 18-6-6 6-6"/>');


// File type icons — filled style for differentiation
const fileSvg = (size: number, color: string, letter: string, letterColor: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><text x="12" y="17" text-anchor="middle" font-size="7" font-weight="bold" font-family="monospace" fill="${letterColor}" stroke="none">${letter}</text></svg>`;

export const iconFileTs: IconFn = (s = 16) => fileSvg(s, '#3178c6', 'TS', '#3178c6');
export const iconFileJs: IconFn = (s = 16) => fileSvg(s, '#f7df1e', 'JS', '#f7df1e');
export const iconFileJson: IconFn = (s = 16) => fileSvg(s, '#a8b1c2', '{}', '#a8b1c2');
export const iconFileHtml: IconFn = (s = 16) => fileSvg(s, '#e44d26', 'H', '#e44d26');
export const iconFileCss: IconFn = (s = 16) => fileSvg(s, '#264de4', 'C', '#264de4');
export const iconFilePy: IconFn = (s = 16) => fileSvg(s, '#3776ab', 'Py', '#3776ab');
export const iconFileMd: IconFn = (s = 16) => fileSvg(s, '#7a8a98', 'M', '#7a8a98');
export const iconFileGeneric: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>');

// ─── Eylem İkonları ──────────────────────────────────────────────
export const iconSend: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>');

export const iconStop: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect x="3" y="3" width="18" height="18" rx="2"/>');

export const iconRefresh: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>');

export const iconPlus: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M5 12h14"/><path d="M12 5v14"/>');

export const iconTrash: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>');

export const iconEdit: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>');

export const iconTerminal: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>');

export const iconPlay: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polygon points="6 3 20 12 6 21 6 3"/>');

export const iconClose: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

export const iconMinimize: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M8 12h8"/>');

export const iconMaximize: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect x="5" y="5" width="14" height="14" rx="1"/>');

export const iconCopy: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');

export const iconCheck: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M20 6 9 17l-5-5"/>');

// ─── Panel İkonları ──────────────────────────────────────────────
export const iconBrain: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>');

export const iconWrench: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>');

export const iconZap: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>');

export const iconKey: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>');

export const iconLogOut: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>');

export const iconStar: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');

export const iconNetwork: IconFn = (s = 20, c = 'currentColor') =>
  svg(s, c, '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>');

export const iconHash: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>');

export const iconDollarSign: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');

export const iconMessageSquare: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');

export const iconPin: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>');

export const iconDownload: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>');

export const iconUpload: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>');

export const iconMic: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>');

export const iconEye: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>');

export const iconEyeOff: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>');

export const iconPanelBottom: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/>');

export const iconPanelRight: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>');

export const iconFileEdit: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.4 21.9a2 2 0 1 1-3.8-1.2l2-6.3 4 1.3-2.2 6.2Z"/>');

export const iconFilePlus: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>');

export const iconFolderPlus: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>');

export const iconRename: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>');

export const iconClipboard: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>');

export const iconAlertTriangle: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>');

export const iconAlertCircle: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');

export const iconInfo: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>');

export const iconToggleLeft: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="8" cy="12" r="2"/>');

export const iconToggleRight: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/>');

export const iconGlobe: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>');

export const iconVolume2: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>');

export const iconBell: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>');

export const iconPalette: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>');

export const iconDatabase: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>');

export const iconShield: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>');

export const iconPlug: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z"/>');

export const iconPuzzle: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M15.39 4.39a1 1 0 0 0 .61.22 2.5 2.5 0 0 1 0 5 1 1 0 0 0-1 1v3.88a1 1 0 0 1-1 1H10.1a1 1 0 0 0-.1.38 2.5 2.5 0 0 1-5 .12 1 1 0 0 0-1-.5H1V11a1 1 0 0 1 1-1 2.5 2.5 0 0 0 .12-5A1 1 0 0 1 1.62 4H5a1 1 0 0 0 1-1 2.5 2.5 0 0 1 5 0 1 1 0 0 0 1 1h3.39Z"/>');

export const iconBarChart: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>');

export const iconSplitVertical: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>');

export const iconMoreVertical: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>');

export const iconExternalLink: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>');

export const iconGift: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>');

export const iconRocket: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>');

export const iconSparkles: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>');

export const iconBookOpen: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');

export const iconCompass: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>');

// ─── Security & Status ───────────────────────────────────────────
export const iconLock: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');

export const iconCheckCircle: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>');

// ─── Kraga Brand ─────────────────────────────────────────────────
export const kragaBirdImg = (size = 24): string =>
  `<img src="./assets/images/logo-bird.png" width="${size}" height="${size}" class="kraga-bird-icon" alt="Open Crow" />`;

export const iconPaperclip: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');

export function getFileIconByExtension(filename: string, size = 16): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return iconFileTs(size);
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return iconFileJs(size);
    case 'json':
      return iconFileJson(size);
    case 'html':
    case 'htm':
      return iconFileHtml(size);
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return iconFileCss(size);
    case 'py':
      return iconFilePy(size);
    case 'md':
    case 'markdown':
      return iconFileMd(size);
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#2bdcff" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    default:
      return iconFileGeneric(size);
  }
}

export const iconType: IconFn = (s = 16, c = 'currentColor') =>
  svg(s, c, '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>');



