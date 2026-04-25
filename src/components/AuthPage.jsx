import React, { useState } from 'react';
import { signInWithPassword, signUp, resetPasswordForEmail } from '../services/authService.js';

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [screen, setScreen] = useState("auth"); // auth | forgot | reset-sent | pw-updated
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!email.includes("@")) errs.email = "Enter a valid email address";
    if (!pw.trim()) errs.pw = "Password is required";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setFieldErr({});
    if (tab === "signup") {
      if (pw.length < 6) { setFieldErr({ pw: "Password must be at least 6 characters" }); setLoading(false); return; }
      const { data, error } = await signUp(email.trim().toLowerCase(), pw);
      setLoading(false);
      if (error) { setFieldErr({ form: error.message }); return; }
      if (data.user && !data.session) {
        setFieldErr({ form: "Check your email to confirm your account before logging in." });
        return;
      }
      if (data.user) onLogin(data.user);
    } else {
      const { data, error } = await signInWithPassword(email.trim().toLowerCase(), pw);
      setLoading(false);
      if (error) { setFieldErr({ form: "Invalid email or password" }); return; }
      onLogin(data.user);
    }
  }

  async function submitForgot(e) {
    e.preventDefault();
    if (!resetEmail.trim() || !resetEmail.includes("@")) { setFieldErr({ resetEmail: "Enter a valid email address" }); return; }
    setFieldErr({});
    setLoading(true);
    await resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
      redirectTo: window.location.href
    });
    setLoading(false);
    setScreen("reset-sent");
  }

  const inputStyle = (errKey) => ({ borderColor: fieldErr[errKey] ? "var(--danger)" : undefined });

  if (screen === "forgot") return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">Parchment Lab</div>
        <div className="auth-tagline" style={{ marginBottom: 20 }}>Reset your password</div>
        {fieldErr.resetEmail && <div className="alert alert-danger">{fieldErr.resetEmail}</div>}
        <form onSubmit={submitForgot}>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" style={inputStyle("resetEmail")} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }} onClick={() => { setScreen("auth"); setFieldErr({}); }}>← Back to Log in</button>
        </div>
      </div>
    </div>
  );

  if (screen === "reset-sent") return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-logo" style={{ marginBottom: 16 }}>Parchment Lab</div>
        <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)", marginBottom: 20 }}>
          If an account exists for <strong style={{ color: "var(--text)" }}>{resetEmail}</strong>, a reset link has been sent.
        </p>
        <button className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setScreen("auth"); setFieldErr({}); }}>Back to Log in</button>
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">Parchment Lab</div>
        <div className="auth-tagline">cosmetic formula management</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setFieldErr({}); }}>Log in</button>
          <button className={`auth-tab ${tab === "signup" ? "active" : ""}`} onClick={() => { setTab("signup"); setFieldErr({}); }}>Sign up</button>
        </div>
        {fieldErr.form && <div className="alert alert-danger">{fieldErr.form}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErr(p => ({ ...p, email: "" })); }} placeholder="you@example.com" style={inputStyle("email")} />
            {fieldErr.email && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{fieldErr.email}</div>}
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setFieldErr(p => ({ ...p, pw: "" })); }} placeholder={tab === "signup" ? "Min. 6 characters" : "Enter your password"} style={inputStyle("pw")} />
            {fieldErr.pw && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{fieldErr.pw}</div>}
          </div>
          {tab === "login" && (
            <div style={{ textAlign: "right", marginTop: -8, marginBottom: 14 }}>
              <button type="button" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12, padding: 0 }}
                onMouseEnter={e => e.target.style.color = "var(--text)"}
                onMouseLeave={e => e.target.style.color = "var(--muted)"}
                onClick={() => { setScreen("forgot"); setResetEmail(email); setFieldErr({}); }}>
                Forgot password?
              </button>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? (tab === "signup" ? "Creating account..." : "Logging in...") : (tab === "signup" ? "Create account" : "Log in")}
          </button>
        </form>
      </div>
    </div>
  );
}
