// Sending emails (step 9) through Resend's HTTP API.
// - RESEND_API_KEY: the Resend key. Set only in Vercel (never in the code or the chat).
// - MAIL_FROM: the sending address, e.g. no-reply@yourdomain.com (a domain verified in Resend).
// The sender NAME is the school's name from the database, and replies go to the
// school's office email, so nothing about a particular school is written here.
// Without a key nothing is sent: on a local copy, MAIL_OUTBOX_DIR keeps each
// email as a .json file for testing; otherwise it is only noted in the log.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Mail = { to: string; subject: string; html: string; text: string; fromName: string; replyTo?: string; tag: string };

const EMAIL = /^[^\s@<>",]+@[^\s@<>",]+\.[a-z]{2,}$/i;
export const isEmail = (s: string) => EMAIL.test(s) && s.length <= 200;

/** Sends one email. Never throws: a failed email must not undo what the person just did. */
export async function sendMail(m: Mail): Promise<boolean> {
  if (!isEmail(m.to)) return false;
  const key = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAIL_FROM ?? "";
  const fromName = m.fromName.replace(/["<>\r\n]/g, "").slice(0, 80);
  const outbox = process.env.MAIL_OUTBOX_DIR;
  if (!key || !isEmail(fromAddress)) {
    if (outbox && !process.env.VERCEL) {
      mkdirSync(outbox, { recursive: true });
      const file = path.join(outbox, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${m.tag}.json`);
      writeFileSync(file, JSON.stringify({ ...m, from: `${fromName} <${fromAddress || "not-set"}>` }, null, 1));
      return true;
    }
    console.warn(`[mail] not sent (${m.tag}): RESEND_API_KEY or MAIL_FROM is not set`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.replyTo && isEmail(m.replyTo) ? { reply_to: m.replyTo } : {}),
        tags: [{ name: "kind", value: m.tag.replace(/[^a-z0-9_-]/gi, "_") }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[mail] Resend refused ${m.tag}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[mail] could not send ${m.tag}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}
