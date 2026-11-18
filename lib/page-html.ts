// The HTML of the school's text pages. Whatever the editor (or an import) sends
// is cleaned here before it is saved: only the formatting the editor offers is
// kept, so a page can never carry scripts or styles of its own. Server only.
import sanitizeHtml from "sanitize-html";

const ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "h5", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "a", "blockquote",
    "ul", "ol", "li", "label", "input", "div",
    "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col", "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "class"],
    th: ["colspan", "rowspan", "colwidth"],
    td: ["colspan", "rowspan", "colwidth"],
    ol: ["start"],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    input: ["type", "checked"],
  },
  allowedClasses: { img: ["hb-logo", "hb-icon"] },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    a: (tag, attribs) => {
      const out: Record<string, string> = { href: attribs.href ?? "" };
      if (attribs.target === "_blank") { out.target = "_blank"; out.rel = "noopener"; }
      return { tagName: "a", attribs: out };
    },
    input: (tag, attribs) =>
      attribs.type === "checkbox"
        ? { tagName: "input", attribs: { type: "checkbox", ...(attribs.checked !== undefined ? { checked: "" } : {}) } }
        : { tagName: "span", attribs: {} },
  },
  exclusiveFilter: (frame) => frame.tag === "input" && frame.attribs.type !== "checkbox",
};

export function cleanPageHtml(html: string) {
  return sanitizeHtml(html, ALLOWED).trim();
}

const plain = (s: string) =>
  s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const slugify = (s: string) =>
  plain(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "section";

/** Gives each heading an id, so the contents and links like #kindergarten work. */
export function withHeadingIds(html: string) {
  const used = new Set<string>();
  let headings = 0;
  const out = html.replace(/<(h[2-5])>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
    headings++;
    const base = slugify(inner);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  return { html: out, headings };
}

/** Text of a page for the list in the staff area ("Kindergarten, 1st Grade…"). */
export function pageOutline(html: string, max = 6) {
  const heads = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => plain(m[1]));
  return heads.length > max ? [...heads.slice(0, max), "…"].join(", ") : heads.join(", ");
}

/** The editor and old pages write portal files relatively ("assets/…"); pages live at /pages/…, so make them absolute. */
export function absolutePaths(html: string) {
  return html.replace(/\s(href|src)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, (_m, attr: string, url: string) => ` ${attr}="/${url}"`);
}
