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

export type Pill = { bg: string; fg: string };
// portal: the two colours chosen when FAMITENLY created the school (step 10). They
// repaint the public pages; a school without them keeps the bundled look.
export type PanelTheme = { shortName: string; markUrl: string; colors: PanelColors; categories: Record<string, Pill>; portal: { primary: string; accent: string } | null };

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
  const categories: Record<string, Pill> = {};
  const cats = (t.categories && typeof t.categories === "object" ? t.categories : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(cats)) if (typeof v === "string" && HEX.test(v)) categories[k] = pill(v);
  const pt = (t.portal && typeof t.portal === "object" ? t.portal : {}) as Record<string, unknown>;
  const portal = typeof pt.primary === "string" && HEX.test(pt.primary) && typeof pt.accent === "string" && HEX.test(pt.accent)
    ? { primary: pt.primary, accent: pt.accent } : null;
  return { shortName, markUrl, colors, categories, portal };
}

const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * t + y[i] * (1 - t))); };
// A category pill: a light tint of the colour, with text dark enough to read (4.5:1).
export function pill(hex: string): Pill {
  const bg = mix(hex, "#FFFFFF", 0.14);
  let fg = hex;
  for (let i = 0; i < 20 && contrast(fg, bg) < 4.5; i++) fg = mix(fg, "#000000", 0.85);
  return { bg, fg };
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

// The public pages' colours for a school created with its own two colours:
// the bundled stylesheet's variables, rebuilt from them.
export function portalColorsCss(p: { primary: string; accent: string }) {
  let link = p.primary;
  for (let i = 0; i < 20 && contrast(link, "#FFFFFF") < 4.5; i++) link = mix(link, "#000000", 0.85);
  const v: Record<string, string> = {
    "--navy": p.primary, "--navy-deep": mix(p.primary, "#000000", 0.75), "--navy-raised": mix(p.primary, "#FFFFFF", 0.85),
    "--navy-hover": mix(p.primary, "#FFFFFF", 0.9), "--cerulean": link, "--gold": p.accent, "--gold-deep": mix(p.accent, "#000000", 0.9),
    "--azure": mix(p.primary, "#FFFFFF", 0.1), "--light-blue": mix(p.primary, "#FFFFFF", 0.22), "--sky": mix(p.primary, "#FFFFFF", 0.45),
  };
  return `:root{${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(";")}}`;
}
