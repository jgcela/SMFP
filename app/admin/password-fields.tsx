"use client";
// The two "new password" boxes used on every screen that sets a password, with
// the requirements listed under them: red with a cross while a requirement is
// not met yet, green with a tick once it is. The server checks the same rules.
import { useId, useState } from "react";

type Props = {
  min: number;
  label?: string;
  confirmLabel?: string;
  hint?: string;
  autoFocus?: boolean;
  /** aria-invalid and friends for each box, when the server refused it. */
  invalidPassword?: object;
  invalidConfirm?: object;
};

export function PasswordFields({ min, label = "Password", confirmLabel = "Repeat the password", hint, autoFocus, invalidPassword, invalidConfirm }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const id = useId();
  const rules = [
    { ok: password.length >= min, text: `At least ${min} characters` },
    { ok: confirm.length > 0 && confirm === password, text: "Both passwords match" },
  ];
  return (
    <>
      <label>
        {label}
        {hint && <span className="hint">{hint}</span>}
        <input type="password" name="password" autoComplete="new-password" minLength={min} maxLength={128} required autoFocus={autoFocus}
          value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={id} {...invalidPassword} />
      </label>
      <label>
        {confirmLabel}
        <input type="password" name="confirm" autoComplete="new-password" maxLength={128} required
          value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-describedby={id} {...invalidConfirm} />
      </label>
      <ul className="pw-rules" id={id} aria-live="polite">
        {rules.map((r) => (
          <li key={r.text} className={r.ok ? "pw-ok" : "pw-no"}>
            <span aria-hidden="true">{r.ok ? "✓" : "✗"}</span>
            {r.text}
            <span className="pw-sr">{r.ok ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
