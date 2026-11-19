// Look of the private panels (staff area and, later, My family).
// Every colour comes from schools.panel_theme; the values below are only a
// neutral fallback for a school that has not set its own yet.

export type PanelColors = {
  page: string; // page background
  surface: string; // cards and sidebar
  ink: string; // titles, active text, dark buttons
  text: string; // body text
  muted: string; // secondary text
  line: string; // borders
  soft: string; // active section pill, light fills
  accent: string; // the one main button per screen
  link: string; // links
};

export type PanelTheme = { shortName: string; markUrl: string; colors: PanelColors };

const FALLBACK: PanelColors = {
  page: "#F3F4F6", surface: "#FFFFFF", ink: "#1F2937", text: "#1F2937", muted: "#4B5563",
  line: "#E5E7EB", soft: "#E5E7EB", accent: "#1F2937", link: "#1D4ED8",
};

const HEX = /^#[0-9a-f]{6}$/i;

function rel(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [rel(a), rel(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Text colour on a fill: the school's ink if it reads well (4.5:1), else black or white.
export function textOn(fill: string, ink: string) {
  if (contrast(fill, ink) >= 4.5) return ink;
  return contrast(fill, "#000000") >= contrast(fill, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

export function readPanelTheme(raw: unknown, schoolName: string): PanelTheme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (t.colors && typeof t.colors === "object" ? t.colors : {}) as Record<string, unknown>;
  const colors = { ...FALLBACK };
  for (const k of Object.keys(FALLBACK) as (keyof PanelColors)[]) {
    if (typeof c[k] === "string" && HEX.test(c[k] as string)) colors[k] = c[k] as string;
  }
  // Body text, secondary text and links must stay readable on the cards.
  for (const k of ["text", "muted", "link", "ink"] as const) {
    if (contrast(colors[k], colors.surface) < 4.5) colors[k] = FALLBACK[k];
  }
  const shortName = typeof t.shortName === "string" && t.shortName.trim() ? t.shortName.trim() : schoolName;
  let markUrl = typeof t.markUrl === "string" ? t.markUrl.trim() : "";
  if (markUrl && !/^(https:)?\/\//.test(markUrl) && !markUrl.startsWith("/")) markUrl = `/${markUrl}`;
  if (/^(javascript|data):/i.test(markUrl)) markUrl = "";
  return { shortName, markUrl, colors };
}

// CSS custom properties set on <body> of the panels.
export function panelVars(t: PanelTheme): React.CSSProperties {
  const c = t.colors;
  return {
    "--p-page": c.page, "--p-surface": c.surface, "--p-ink": c.ink, "--p-text": c.text, "--p-muted": c.muted,
    "--p-line": c.line, "--p-soft": c.soft, "--p-on-soft": textOn(c.soft, c.ink), "--p-accent": c.accent,
    "--p-on-accent": textOn(c.accent, c.ink), "--p-link": c.link, "--p-on-ink": textOn(c.ink, c.surface),
  } as React.CSSProperties;
}
