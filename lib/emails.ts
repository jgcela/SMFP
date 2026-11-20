// The emails of step 9, in English, with the school's name, logo and colours
// (all read from the database). Each function returns a Mail ready for sendMail().
import { headers } from "next/headers";
import { db } from "./db";
import { sendMail, type Mail } from "./mail";
import { readPanelTheme, textOn } from "./panel-theme";

export type MailSchool = {
  id: number; name: string; email: string; phone: string; notifyEmail: string;
  logo: string; ink: string; onInk: string; accent: string; onAccent: string; page: string; text: string; muted: string;
};

export async function mailSchool(schoolId: number): Promise<MailSchool | null> {
  const [s] = await db()<{ id: number; name: string; email: string; phone_display: string; notify_email: string; logo_url: string | null; panel_theme: unknown }[]>`
    select id, name, email, phone_display, notify_email, logo_url, panel_theme from schools where id = ${schoolId}`;
  if (!s) return null;
  const c = readPanelTheme(s.panel_theme, s.name).colors;
  return {
    id: s.id, name: s.name, email: s.email, phone: s.phone_display, notifyEmail: s.notify_email,
    logo: s.logo_url ?? "", ink: c.ink, onInk: textOn(c.ink, c.surface), accent: c.accent, onAccent: textOn(c.accent, c.ink),
    page: c.page, text: c.text, muted: c.muted,
  };
}

/** The address of this portal, for links in emails: PORTAL_URL if set, else the address the person used. */
export async function portalOrigin(): Promise<string> {
  const fixed = (process.env.PORTAL_URL ?? "").replace(/\/+$/, "");
  if (/^https?:\/\/[^/\s]+$/.test(fixed)) return fixed;
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http")).split(",")[0].trim();
  return `${proto}://${host}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Body = { preheader: string; title: string; paras: string[]; button?: { label: string; href: string }; after?: string[] };

// A simple, table-based layout that email programs show reliably.
function render(s: MailSchool, origin: string, b: Body) {
  const logo = s.logo ? (/^https?:\/\//.test(s.logo) ? s.logo : `${origin}/${s.logo.replace(/^\/+/, "")}`) : "";
  const p = (t: string) => `<p style="margin:0 0 16px;font:16px/24px Arial,Helvetica,sans-serif;color:${s.text}">${esc(t)}</p>`;
  const contact = [s.email, s.phone].filter(Boolean).map(esc).join(" · ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.title)}</title></head>
<body style="margin:0;padding:0;background:${s.page}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(b.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${s.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${s.ink};padding:20px 28px">${logo ? `<img src="${esc(logo)}" alt="${esc(s.name)}" height="48" style="display:block;height:48px;width:auto;border:0">` : `<span style="font:700 18px/24px Arial,Helvetica,sans-serif;color:${s.onInk}">${esc(s.name)}</span>`}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font:700 22px/30px Arial,Helvetica,sans-serif;color:${s.ink}">${esc(b.title)}</h1>
${b.paras.map(p).join("\n")}
${b.button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:${s.accent};border-radius:999px"><a href="${esc(b.button.href)}" style="display:inline-block;padding:12px 24px;font:700 16px/20px Arial,Helvetica,sans-serif;color:${s.onAccent};text-decoration:none">${esc(b.button.label)}</a></td></tr></table>
<p style="margin:0 0 16px;font:13px/20px Arial,Helvetica,sans-serif;color:${s.muted}">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${esc(b.button.href)}</span></p>` : ""}
${(b.after ?? []).map(p).join("\n")}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font:13px/20px Arial,Helvetica,sans-serif;color:${s.muted}">${esc(s.name)}${contact ? `<br>${contact}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [b.title, "", ...b.paras, ...(b.button ? ["", `${b.button.label}: ${b.button.href}`] : []), ...(b.after?.length ? ["", ...b.after] : []), "", "--", s.name, contact.replace(/&amp;/g, "&")]
    .join("\n");
  return { html, text };
}

function mail(s: MailSchool, origin: string, to: string, tag: string, subject: string, b: Body): Mail {
  return { to, tag, subject, fromName: s.name, replyTo: s.email || undefined, ...render(s, origin, b) };
}

const IGNORE = "If you did not ask for this, you can ignore this email. Nothing will change.";

// ---- The emails ----

export const emails = {
  familyReceived: (s: MailSchool, o: string, to: string, familyName: string) =>
    mail(s, o, to, "family_received", `We received your account request — ${s.name}`, {
      preheader: "The school office will review it soon.",
      title: "We received your account request",
      paras: [
        `Hello ${familyName},`,
        `Thank you for creating a family account on the ${s.name} portal. The school office will review it soon.`,
        "You can sign in once the school approves your account. We will send you another email when that happens.",
      ],
    }),

  familyApproved: (s: MailSchool, o: string, to: string, familyName: string) =>
    mail(s, o, to, "family_approved", `Your family account is approved — ${s.name}`, {
      preheader: "You can sign in now.",
      title: "Your family account is approved",
      paras: [`Hello ${familyName},`, `The school approved your family account on the ${s.name} portal. You can sign in now.`],
      button: { label: "Sign in", href: `${o}/family` },
      after: ["Sign in with the email and password you chose when you created the account."],
    }),

  familyRejected: (s: MailSchool, o: string, to: string, familyName: string) =>
    mail(s, o, to, "family_rejected", `About your family account — ${s.name}`, {
      preheader: "The school did not approve this account.",
      title: "The school did not approve this account",
      paras: [
        `Hello ${familyName},`,
        `The school did not approve the family account you created on the ${s.name} portal, so you cannot sign in with it.`,
        "If you think this is a mistake, please contact the school office.",
      ],
    }),

  schoolNewFamily: (s: MailSchool, o: string, to: string, familyName: string, familyEmail: string) =>
    mail(s, o, to, "school_new_family", `New family waiting for approval: ${familyName}`, {
      preheader: `${familyName} created a family account.`,
      title: "A new family is waiting for approval",
      paras: [`${familyName} (${familyEmail}) created a family account on the portal.`, "They can sign in only after you approve them."],
      button: { label: "Review families", href: `${o}/admin/families` },
    }),

  resetPassword: (s: MailSchool, o: string, to: string, link: string) =>
    mail(s, o, to, "reset_password", `Reset your password — ${s.name}`, {
      preheader: "This link works for 1 hour.",
      title: "Reset your password",
      paras: ["We received a request to reset the password of your account on the portal.", "The link works for 1 hour, and only once."],
      button: { label: "Choose a new password", href: link },
      after: [IGNORE],
    }),

  confirmEmail: (s: MailSchool, o: string, to: string, link: string) =>
    mail(s, o, to, "confirm_email", `Confirm your new email — ${s.name}`, {
      preheader: "This link works for 1 hour.",
      title: "Confirm your new email",
      paras: [
        "Someone asked to use this email for an account on the portal. Confirm it to make the change.",
        "The link works for 1 hour, and only once. Until you confirm, the account keeps its old email.",
      ],
      button: { label: "Confirm this email", href: link },
      after: [IGNORE],
    }),
};

/** Builds and sends one of the emails above for a school. */
export async function sendSchoolMail<K extends keyof typeof emails>(
  schoolId: number, kind: K, to: string, ...args: Parameters<(typeof emails)[K]> extends [MailSchool, string, string, ...infer R] ? R : never
): Promise<boolean> {
  try {
    const s = await mailSchool(schoolId);
    if (!s) return false;
    const o = await portalOrigin();
    const build = emails[kind] as (s: MailSchool, o: string, to: string, ...a: unknown[]) => Mail;
    return await sendMail(build(s, o, to, ...args));
  } catch (e) {
    console.error(`[mail] ${kind}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}
