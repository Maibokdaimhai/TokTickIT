import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { TokTickLogo } from "./TokTickLogo.js";
import { passwordRules } from "../utils/password-rules.js";
import { AuthError } from "../api.js";

export function AuthPage({ change = false, onDone }: { change?: boolean; onDone?: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [currentError, setCurrentError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setFieldError(""); setConfirmationError(""); setCurrentError("");
    if (change) {
      const invalid = passwordRules(newPassword).filter(rule => !rule.valid);
      if (invalid.length) { setFieldError(invalid.map(rule => rule.label).join(". ")); return; }
      if (newPassword !== confirm) { setConfirmationError("Password confirmation must match exactly."); return; }
    }
    setBusy(true);
    try {
      if (change) { await auth.changePassword(password, newPassword, confirm); onDone?.(); }
      else await auth.login(email, password);
    } catch (reason) {
      if (change && reason instanceof AuthError && reason.code === "CURRENT_PASSWORD_INVALID") setCurrentError(reason.message);
      else if (change && reason instanceof AuthError && reason.code === "VALIDATION_ERROR") setFieldError(reason.message);
      else setError(reason instanceof Error ? reason.message : "Unable to complete request");
    }
    finally { setPassword(""); setNewPassword(""); setConfirm(""); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <TokTickLogo size={48} /><h1 id="auth-title">{change ? "Change password" : "Sign in to TokTickIT"}</h1>
    {change && <p id="password-help">Use at least 10 characters, including uppercase, lowercase, a number and a symbol. Maximum 72 UTF-8 bytes. Choose a different password.</p>}
    {change && auth.session?.mustChangePassword && <p>You must change your initial password before continuing.</p>}
    {(error || auth.error) && <div className="alert alert-danger" role="alert">{error || auth.error}</div>}
    <form onSubmit={submit}>
      {!change && <label className="auth-field">Email<input className="form-control" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>}
      <label className="auth-field">{change ? "Current password" : "Password"}<input className="form-control" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(currentError)} aria-describedby="current-password-error" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <p id="current-password-error" className="text-danger">{currentError}</p>
      <button type="button" className="btn btn-outline-secondary" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide password" : "Show password"}</button>
      {change && <><label className="auth-field">New password<input className="form-control" type="password" autoComplete="new-password" aria-describedby="password-help new-password-error" aria-invalid={Boolean(fieldError)} required value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={busy} /></label>
        <p id="new-password-error" className="text-danger">{fieldError}</p>
        <ul aria-label="Password requirements">{passwordRules(newPassword).map(rule => <li key={rule.label}>{rule.valid ? "✓" : "○"} {rule.label}</li>)}</ul>
        <label className="auth-field">Confirm new password<input className="form-control" type="password" autoComplete="new-password" aria-describedby="confirmation-error" aria-invalid={Boolean(confirmationError)} required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} /></label><p id="confirmation-error" className="text-danger">{confirmationError}</p></>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {change ? "Saving…" : "Signing in…"}</> : change ? "Save new password" : "Sign in"}</button>
      {change && <button className="btn btn-outline-secondary" type="button" disabled={busy} onClick={() => { void auth.logout().catch(reason => setError(reason.message)); }}>Sign out</button>}
      {change && !auth.session?.mustChangePassword && <button className="btn btn-outline-secondary" type="button" onClick={onDone} disabled={busy}>Cancel</button>}
    </form>
  </section></main>;
}
