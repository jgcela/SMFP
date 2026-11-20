// The school's contact details: checks shared by the browser (to warn before
// saving) and the server (which checks again), and the links built from them.
// No school data here: it all comes from the database.

const EMAIL = /^[A-Za-z0-9._%+'-]+@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

export function checkEmail(raw: string, required = true): string | null {
  const v = raw.trim();
  if (!v) return required ? "Enter the email address." : null;
  if (/\s/.test(v)) return "The email has a space in it. Check that it is written correctly.";
  if ((v.match(/@/g) ?? []).length !== 1) return "An email has exactly one @, like office@school.org.";
  if (!EMAIL.test(v) || v.includes("..")) return "This email is not written correctly. It should look like office@school.org.";
  return null;
}

// US numbers: 10 digits, or 11 starting with 1. Others: start with + and 8 to 15 digits.
function phoneDigits(raw: string) {
  const v = raw.trim();
  if (!/^\+?[\d\s().\-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  if (v.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function checkPhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter the phone number.";
  if (/[a-z]/i.test(v)) return "The phone number can only have digits, spaces, dashes, dots and brackets.";
  if (!phoneDigits(v)) {
    const n = v.replace(/\D/g, "").length;
    return `The phone number has ${n} digit${n === 1 ? "" : "s"}. A US number has 10, like (303) 555-0123. Numbers from other countries start with +.`;
  }
  return null;
}

/** "(303) 555-0123" -> "tel:+13035550123" (what phones need to start the call). */
export function phoneHref(raw: string) {
  const d = phoneDigits(raw);
  return d ? `tel:${d}` : "";
}

/** Opens the map app on phones, and Google Maps on a computer. */
export function mapsHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s+/g, " ").trim())}`;
}
