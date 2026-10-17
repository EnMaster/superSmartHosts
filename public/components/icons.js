import { html } from "preact";

const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.9", "stroke-linecap": "round", "stroke-linejoin": "round" };

export const IconRoute = (p) =>
  html`<svg ...${base} width=${p.size || 20} height=${p.size || 20}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 7.6 15.8 16.4" /></svg>`;

export const IconSearch = (p) =>
  html`<svg ...${base} width=${p.size || 14} height=${p.size || 14}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>`;

export const IconPlus = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M12 5v14M5 12h14" /></svg>`;

export const IconTrash = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" /></svg>`;

export const IconPlay = (p) =>
  html`<svg ...${base} width=${p.size || 14} height=${p.size || 14} fill="currentColor" stroke="none"><path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z" /></svg>`;

export const IconCopy = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>`;

export const IconChevron = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="m9 6 6 6-6 6" /></svg>`;

export const IconClose = (p) =>
  html`<svg ...${base} width=${p.size || 16} height=${p.size || 16}><path d="M6 6l12 12M18 6 6 18" /></svg>`;

export const IconHelp = (p) =>
  html`<svg ...${base} width=${p.size || 13} height=${p.size || 13}><circle cx="12" cy="12" r="9" /><path d="M9.2 9a3 3 0 1 1 4.4 2.7c-.9.5-1.6 1-1.6 2.1" /><path d="M12 17h.01" /></svg>`;

export const IconCode = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></svg>`;

export const IconSave = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>`;

export const IconTerminal = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></svg>`;

export const IconBolt = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>`;

export const IconArrow = (p) =>
  html`<svg ...${base} width=${p.size || 13} height=${p.size || 13}><path d="M4 12h15M13 6l6 6-6 6" /></svg>`;

export const IconBranch = (p) =>
  html`<svg ...${base} width=${p.size || 14} height=${p.size || 14}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="9" r="2.2" /><path d="M6 8.2v7.6M6 12h6a4 4 0 0 0 4-4v-.8" /></svg>`;

export const IconMore = (p) =>
  html`<svg ...${base} width=${p.size || 16} height=${p.size || 16}><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></svg>`;

export const IconTemplate = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>`;

export const IconDuplicate = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>`;

export const IconWarn = (p) =>
  html`<svg ...${base} width=${p.size || 14} height=${p.size || 14}><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>`;

export const IconSearchPlus = (p) =>
  html`<svg ...${base} width=${p.size || 14} height=${p.size || 14}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2M11 8v6M8 11h6" /></svg>`;

export const IconGlobe = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" /></svg>`;

export const IconRestore = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /></svg>`;

export const IconArchive = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 13h4" /></svg>`;

export const IconPencil = (p) =>
  html`<svg ...${base} width=${p.size || 15} height=${p.size || 15}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>`;
