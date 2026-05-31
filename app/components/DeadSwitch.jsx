"use client";

import { supabase } from "../supabase";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useWalletClient, usePublicClient } from "wagmi";
import { parseEventLogs, parseUnits } from "viem";
import {
  AlertTriangle, Bell, ChevronRight, Clock, LockKeyhole,
  LogOut, Mail, Moon, Pause, Pencil, Play, Plus,
  Radar, Shield, Sun, X, Zap,
} from "lucide-react";

const D = {
  bg: "#05060A", bg2: "#0A0C14",
  surface: "rgba(14,18,28,0.88)", surfaceUp: "rgba(22,28,42,0.92)",
  panel: "rgba(9,11,18,0.80)", border: "rgba(255,255,255,0.07)",
  borderUp: "rgba(255,255,255,0.13)", text: "#F0F4FF",
  textSub: "#8B96B0", textMuted: "#4A5568",
  accent: "#00D4A8", accent2: "#6B7FFF",
  accentLow: "rgba(0,212,168,0.08)", accentMid: "rgba(0,212,168,0.16)",
  warn: "#F4B740", warnLow: "rgba(244,183,64,0.10)",
  danger: "#F36B7F", dangerLow: "rgba(243,107,127,0.10)",
  shadow: "0 32px 100px rgba(0,0,0,0.60)",
};

const L = {
  bg: "#F4F6F2", bg2: "#E8ECE5",
  surface: "rgba(255,255,255,0.90)", surfaceUp: "rgba(244,246,242,0.97)",
  panel: "rgba(255,255,255,0.75)", border: "rgba(11,19,32,0.08)",
  borderUp: "rgba(11,19,32,0.14)", text: "#0F1723",
  textSub: "#4A5568", textMuted: "#8B95A7",
  accent: "#00A888", accent2: "#4657D8",
  accentLow: "rgba(0,143,115,0.08)", accentMid: "rgba(0,143,115,0.15)",
  warn: "#B7791F", warnLow: "rgba(183,121,31,0.10)",
  danger: "#C8354B", dangerLow: "rgba(200,53,75,0.10)",
  shadow: "0 28px 80px rgba(23,32,48,0.12)",
};

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
];
const TIMER_PRESETS = { minutes: [1, 2, 5, 10, 30, 60], days: [2, 5, 30, 60, 90, 180] };
const WARNING_SECONDS = 2 * 60;
const YEARLY_MAX_SWITCHES = 999999;
const TIERS = [
  { id: 0, key: "free", name: "Free", price: 0, duration: "Forever", switches: 1, timer: "30 days", maxTimerSeconds: 30 * 86400, note: "Try DeadSwitch with one active backup plan." },
  { id: 1, key: "monthly", name: "Monthly", price: 15, duration: "30 days", switches: 2, timer: "90 days", maxTimerSeconds: 90 * 86400, note: "A small plan for testing real recovery flows." },
  { id: 2, key: "sixmonth", name: "6 Month", price: 50, duration: "180 days", switches: 5, timer: "180 days", maxTimerSeconds: 180 * 86400, note: "Best for personal wallets and a few backup routes.", featured: true },
  { id: 3, key: "yearly", name: "Yearly", price: 150, duration: "365 days", switches: YEARLY_MAX_SWITCHES, timer: "365 days", maxTimerSeconds: 365 * 86400, note: "For power users, teams, and serious vault setups." },
];

function truncateWallet(value = "") {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
function timerUnit(sw) { return sw?.timer_unit || "days"; }
function durationSeconds(sw) {
  const value = Number(sw?.days || 1);
  return timerUnit(sw) === "minutes" ? value * 60 : value * 86400;
}
function secondsLeft(sw, now = new Date()) {
  if (!sw || sw.status === "triggered" || sw.status === "cancelled") return 0;
  if (sw.status === "paused") return timerUnit(sw) === "minutes" ? Math.max(0, Number(sw.remaining || 0)) * 60 : Math.max(0, Number(sw.remaining || 0)) * 86400;
  const duration = durationSeconds(sw);
  const startedAt = sw.created_at ? new Date(sw.created_at).getTime() : now.getTime();
  const elapsed = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
  return Math.max(0, duration - elapsed);
}
function withLiveTimer(sw, now) {
  const remainingSeconds = secondsLeft(sw, now);
  const unit = timerUnit(sw);
  const remaining = unit === "minutes" ? Math.ceil(remainingSeconds / 60) : Math.ceil(remainingSeconds / 86400);
  const status = sw.status === "active" && remainingSeconds <= WARNING_SECONDS ? "warning" : sw.status;
  return { ...sw, remaining, remainingSeconds, status, timer_unit: unit };
}
function timerLabel(sw) {
  const unit = timerUnit(sw);
  const value = Number(sw?.remaining || 0);
  if (value <= 0) return "EXECUTING SOON";
  return `${value} ${unit === "minutes" ? "MIN" : value === 1 ? "DAY" : "DAYS"} REMAINING`;
}
function tierById(id = 0) {
  return TIERS.find((tier) => tier.id === Number(id)) || TIERS[0];
}
function formatMaxSwitches(value) {
  if (!value || Number(value) >= YEARLY_MAX_SWITCHES) return "Unlimited";
  return `${value}`;
}
function formatPlanExpiry(expiresAt) {
  if (!expiresAt || Number(expiresAt) === 0) return "Forever";
  return `Until ${new Date(Number(expiresAt) * 1000).toLocaleDateString()}`;
}
function formatMaxTimer(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "30 days";
  const days = Math.round(value / 86400);
  return `${days} day${days === 1 ? "" : "s"}`;
}
function statusMeta(status, t) {
  const map = {
    active:    { label: "Watching",       color: t.accent,    bg: t.accentLow,  Icon: Radar },
    warning:   { label: "Deadline close", color: t.warn,      bg: t.warnLow,    Icon: AlertTriangle },
    paused:    { label: "Paused",         color: t.textMuted, bg: t.surfaceUp,  Icon: Pause },
    triggered: { label: "Executed",       color: t.accent,    bg: t.accentLow,  Icon: Zap },
    cancelled: { label: "Cancelled",      color: t.textMuted, bg: t.surfaceUp,  Icon: X },
  };
  return map[status] || map.active;
}

function DSLogo({ size = 34, t }) {
  const s = size, cx = s * 0.5, cy = s * 0.5;
  const pillW = s * 0.72, pillH = s * 0.33;
  const pillX = cx - pillW / 2, pillY = cy - pillH / 2;
  const r = pillH / 2, dotR = r * 0.72;
  const leftDot = pillX + r, rightDot = pillX + pillW - r;
  const px2 = pillX - 2;
  const pts = [[0,cy],[px2*.35,cy],[px2*.52,cy-s*.22],[px2*.68,cy+s*.22],[px2*.84,cy],[px2,cy]].map(([x,y])=>`${x},${y}`).join(" ");
  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} fill="none" aria-hidden="true">
        <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={r} stroke={t.accent} strokeWidth={s*.055} />
        <circle cx={leftDot} cy={cy} r={dotR} fill={t.accent} opacity="0.2" />
        <circle cx={rightDot} cy={cy} r={dotR*1.05} fill={t.accent} />
        <circle cx={rightDot} cy={cy} r={dotR*1.6} fill={t.accent} opacity="0.12" />
        <polyline points={pts} stroke={t.accent} strokeWidth={s*.048} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={pillX+pillW+2} y1={cy} x2={s} y2={cy} stroke={t.accent} strokeWidth={s*.048} strokeLinecap="round" opacity="0.35" />
      </svg>
      <span style={{ position: "absolute", inset: -4, borderRadius: 18, boxShadow: `0 0 32px ${t.accent}30`, pointerEvents: "none" }} />
    </div>
  );
}

function IconButton({ children, title, onClick, t, tone = "neutral" }) {
  const color = tone === "danger" ? t.danger : tone === "warn" ? t.warn : t.textSub;
  const bg = tone === "danger" ? t.dangerLow : tone === "warn" ? t.warnLow : t.surfaceUp;
  return (
    <button onClick={onClick} title={title} style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${t.border}`, background: bg, color, cursor: "pointer", display: "grid", placeItems: "center" }}>
      {children}
    </button>
  );
}

function StatusPill({ status, t }) {
  const meta = statusMeta(status, t);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30`, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em" }}>
      <meta.Icon size={11} strokeWidth={2.5} />{meta.label}
    </span>
  );
}

function ProgressBar({ sw, remaining, days, t }) {
  const total = sw ? durationSeconds(sw) : Number(days || 1);
  const left = sw ? Number(sw.remainingSeconds || 0) : Number(remaining || 0);
  const pct = Math.max(0, Math.min(100, (left / Number(total || 1)) * 100));
  const color = pct <= 15 ? t.warn : pct <= 35 ? t.warn : t.accent;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <strong style={{ color, fontSize: 11, letterSpacing: "0.08em", fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>
          {sw ? timerLabel(sw) : Number(remaining) <= 0 ? "EXECUTING SOON" : `${remaining} REMAINING`}
        </strong>
        <span style={{ color: t.textMuted, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: t.surfaceUp, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${t.accent2})`, boxShadow: `0 0 10px ${color}50`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

/* AUTH */
function AuthScreen({ t, initialMode = "signin", onPasswordResetComplete }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const inp = { width: "100%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.35)", color: "#F0F4FF", borderRadius: 12, padding: "13px 15px", outline: "none", fontSize: 14, boxSizing: "border-box" };

  useEffect(() => {
    let ignore = false;
    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
      const isRecovery = url.searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery" || initialMode === "reset";
      const code = url.searchParams.get("code");
      if (!isRecovery) return;
      setMode("reset"); setError(null); setMessage("Preparing secure password reset...");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (ignore) return;
        if (error) { setError(error.message); setMessage(null); return; }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      if (!ignore) setMessage("Enter a new password for your DeadSwitch account.");
    }
    prepareRecoverySession();
    return () => { ignore = true; };
  }, [initialMode]);

  async function handleSignIn() {
    if (!email || !password) return setError("Please enter email and password");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }
  async function handleSignUp() {
    if (!email || !password) return setError("Please enter email and password");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else setMessage("Account created! Sign in to continue.");
    setLoading(false);
  }
  async function handleMagicLink() {
    if (!email) return setError("Please enter your email");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setError(error.message);
    else setMessage("Magic link sent! Check your email.");
    setLoading(false);
  }
  async function handleForgotPassword() {
    if (!email) return setError("Please enter your email");
    setLoading(true); setError(null); setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}?type=recovery` });
    if (error) setError(error.message);
    else setMessage("Password reset link sent. Check your email.");
    setLoading(false);
  }
  async function handlePasswordReset() {
    if (!password) return setError("Please enter a new password");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true); setError(null); setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else { setMessage("Password updated. You can continue to your dashboard."); setPassword(""); setConfirmPassword(""); onPasswordResetComplete?.(); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% -10%, rgba(0,212,168,0.10) 0%, transparent 55%), linear-gradient(160deg, #05060A 0%, #0A0C14 100%)", display: "grid", placeItems: "center", padding: 16, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,650;0,9..40,800;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        button, input { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.78)} }
      `}</style>
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", border: "1px solid rgba(0,212,168,0.03)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 450, height: 450, borderRadius: "50%", border: "1px solid rgba(0,212,168,0.05)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.5s ease", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <div style={{ padding: 14, borderRadius: 22, background: "rgba(0,212,168,0.08)", border: "1px solid rgba(0,212,168,0.15)", marginBottom: 18, boxShadow: "0 0 40px rgba(0,212,168,0.10)" }}>
            <DSLogo size={48} t={D} />
          </div>
          <h1 style={{ color: "#F0F4FF", fontSize: 26, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.04em" }}>DeadSwitch</h1>
          <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 13, margin: 0, letterSpacing: "0.02em" }}>Your trustless crypto backup agent</p>
        </div>
        <div style={{ background: "rgba(14,18,28,0.92)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: 28, boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,212,168,0.04)", position: "relative", overflow: "hidden", backdropFilter: "blur(20px)" }}>
          <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,168,0.55), transparent)" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "radial-gradient(ellipse at 50% -20%, rgba(0,212,168,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
          {mode !== "forgot" && mode !== "reset" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 24, background: "rgba(0,0,0,0.30)", borderRadius: 14, padding: 4 }}>
              {[["signin","Sign In"],["signup","Sign Up"],["magic","Magic Link"]].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }} style={{ padding: "9px 0", borderRadius: 10, border: "none", background: mode===m ? "rgba(0,212,168,0.12)" : "transparent", color: mode===m ? "#00D4A8" : "rgba(255,255,255,0.30)", fontWeight: mode===m ? 800 : 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.01em" }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
            {mode !== "reset" && (
              <div>
                <label style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", display: "block", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>EMAIL</label>
                <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            )}
            {mode !== "magic" && mode !== "forgot" && (
              <div>
                <label style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", display: "block", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}</label>
                <input style={inp} type="password" placeholder={mode==="signup"||mode==="reset" ? "Min. 6 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key==="Enter" && (mode==="signin" ? handleSignIn() : mode==="signup" ? handleSignUp() : handlePasswordReset())} />
              </div>
            )}
            {mode === "reset" && (
              <div>
                <label style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", display: "block", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>CONFIRM PASSWORD</label>
                <input style={inp} type="password" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handlePasswordReset()} />
              </div>
            )}
          </div>
          {error   && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(243,107,127,0.10)", border: "1px solid rgba(243,107,127,0.25)", color: "#F36B7F", fontSize: 13 }}>{error}</div>}
          {message && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(0,212,168,0.08)", border: "1px solid rgba(0,212,168,0.25)", color: "#00D4A8", fontSize: 13 }}>{message}</div>}
          <button onClick={mode==="signin" ? handleSignIn : mode==="signup" ? handleSignUp : mode==="magic" ? handleMagicLink : mode==="forgot" ? handleForgotPassword : handlePasswordReset}
            style={{ width: "100%", marginTop: 20, padding: "14px 0", background: "linear-gradient(135deg, #00D4A8, #6B7FFF)", border: "none", borderRadius: 13, color: "#000", fontSize: 14, fontWeight: 900, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s", letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(0,212,168,0.25)" }}>
            {loading ? "Please wait..." : mode==="signin" ? "Sign in →" : mode==="signup" ? "Create account →" : mode==="magic" ? "Send magic link →" : mode==="forgot" ? "Send reset link →" : "Update password →"}
          </button>
          {mode === "signin" && (
            <button onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}>
              Forgot password?
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 10, fontWeight: 700, letterSpacing: "0.10em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, textAlign: "center", margin: 0 }}>
            {mode==="signin" ? <>No account? <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#00D4A8", fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign up</button></> :
             mode==="signup" ? <>Already have an account? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#00D4A8", fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></> :
             <>Remember your password? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#00D4A8", fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></>}
          </p>
        </div>
        <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, textAlign: "center", marginTop: 24, fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em" }}>DEADSWITCH · ARC TESTNET · USDC</p>
      </div>
    </div>
  );
}

/* SUBSCRIPTION */
function SubscriptionPanel({ subscription, onSubscribe, subscribing, isConnected, t, dark, isMobile, onClose, prompt }) {
  const currentTier = tierById(subscription?.tier || 0);
  const maxSwitches = subscription?.maxSwitches || currentTier.switches;
  const maxTimer = subscription?.maxTimer || currentTier.maxTimerSeconds;
  const activeCount = subscription?.activeSwitchCount || 0;

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose?.()} style={{ position: "fixed", inset: 0, zIndex: 240, display: "grid", placeItems: "center", padding: isMobile ? 12 : 22, background: dark ? "rgba(0,0,0,0.78)" : "rgba(15,23,35,0.34)", backdropFilter: "blur(22px)", animation: "fadeUp .2s ease" }}>
    <section style={{ width: "100%", maxWidth: 1120, maxHeight: "92vh", overflow: "auto", padding: isMobile ? 18 : 24, borderRadius: 24, border: `1px solid ${t.borderUp}`, background: dark ? "rgba(10,13,22,0.98)" : "rgba(255,255,255,0.98)", boxShadow: t.shadow }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <p style={{ color: t.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.16em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>PLAN ACCESS</p>
          <h2 style={{ color: t.text, fontSize: isMobile ? 24 : 32, margin: 0, letterSpacing: "-0.04em", fontWeight: 900 }}>Choose how much backup room you need</h2>
          <p style={{ color: t.textSub, fontSize: 13, lineHeight: 1.6, margin: "8px 0 0", maxWidth: 580 }}>Pick Free to continue immediately, or choose a paid plan and your wallet will ask you to approve and pay in USDC.</p>
          {prompt && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${t.warn}35`, background: t.warnLow, color: t.warn, fontSize: 12, fontWeight: 850, lineHeight: 1.45, maxWidth: 620 }}>
              {prompt}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ padding: "10px 13px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 12, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
            Current: <strong style={{ color: t.accent }}>{currentTier.name}</strong> · {formatPlanExpiry(subscription?.expiresAt)}<br />
            {activeCount}/{formatMaxSwitches(maxSwitches)} active · max {formatMaxTimer(maxTimer)}
          </div>
          <IconButton onClick={onClose} title="Close plans" t={t}><X size={15} /></IconButton>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {TIERS.map((tier) => {
          const isCurrent = currentTier.id === tier.id;
          const isLoading = subscribing === tier.id;
          const isLockedCurrent = isCurrent && tier.id !== 0;
          return (
            <article key={tier.key} style={{ position: "relative", minHeight: 250, padding: 18, borderRadius: 20, border: `1px solid ${tier.featured ? `${t.accent}45` : t.border}`, background: tier.featured ? `linear-gradient(160deg, ${t.accentLow}, ${t.panel})` : t.panel, boxShadow: tier.featured && dark ? "0 20px 70px rgba(0,212,168,0.10)" : "none", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${tier.featured ? t.accent : t.borderUp}, transparent)` }} />
              {tier.featured && (
                <span style={{ display: "inline-flex", marginBottom: 12, padding: "4px 8px", borderRadius: 999, background: t.accentLow, color: t.accent, border: `1px solid ${t.accent}30`, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}>
                  RECOMMENDED
                </span>
              )}
              <h3 style={{ color: t.text, fontSize: 18, margin: tier.featured ? "0 0 6px" : "26px 0 6px", fontWeight: 900, letterSpacing: "-0.03em" }}>{tier.name}</h3>
              <p style={{ color: t.textSub, fontSize: 12, lineHeight: 1.6, minHeight: 40, margin: "0 0 14px" }}>{tier.note}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 14 }}>
                <span style={{ color: t.text, fontSize: 30, fontWeight: 900, letterSpacing: "-0.05em" }}>{tier.price ? tier.price : "0"}</span>
                <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>USDC</span>
              </div>
              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {[
                  `${formatMaxSwitches(tier.switches)} active switch${tier.switches === 1 ? "" : "es"}`,
                  `Timers up to ${tier.timer}`,
                  tier.price ? `${tier.duration} access` : "No wallet payment needed",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: 8, alignItems: "center", color: t.textSub, fontSize: 12 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
              <button
                onClick={() => onSubscribe(tier)}
                disabled={isLockedCurrent || isLoading}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1px solid ${isLockedCurrent ? t.border : t.accent}33`, background: isLockedCurrent ? t.surfaceUp : tier.price ? "linear-gradient(135deg, #00D4A8, #6B7FFF)" : t.accentLow, color: isLockedCurrent ? t.textMuted : tier.price ? "#000" : t.accent, cursor: isLockedCurrent || isLoading ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 13, opacity: isLoading ? 0.65 : 1 }}
              >
                {isLockedCurrent ? "Current plan" : isLoading ? "Processing..." : !isConnected && tier.price > 0 ? "Connect wallet to pay" : tier.price ? `Pay ${tier.price} USDC` : "Use free"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
    </div>
  );
}

/* AGENT CONSOLE */
function AgentConsole({ switches, nextSwitch, t, isMobile }) {
  const active = switches.filter((s) => s.status==="active"||s.status==="warning").length;
  const warnings = switches.filter((s) => s.status==="warning"||Number(s.remainingSeconds)<=WARNING_SECONDS).length;
  const rows = [
    { icon: Radar,  label: "Status",  value: active ? "Watching" : "Idle",                   color: active ? t.accent : t.textMuted },
    { icon: Bell,   label: "Alerts",  value: warnings ? `${warnings} due soon` : "All clear", color: warnings ? t.warn : t.accent },
    { icon: Shield, label: "Network", value: "Arc Testnet",                                   color: t.accent2 },
  ];
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 590, justifySelf: "end", background: `linear-gradient(160deg, ${t.surface}, ${t.panel})`, border: `1px solid ${t.borderUp}`, borderRadius: 24, padding: isMobile ? 16 : 20, boxShadow: t.shadow, overflow: "hidden", backdropFilter: "blur(20px)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 80% -10%, ${t.accentLow} 0%, transparent 50%), radial-gradient(ellipse at 20% 110%, ${t.accentMid} 0%, transparent 52%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: `linear-gradient(90deg, transparent, ${t.accent}70, transparent)` }} />
      <div style={{ position: "relative" }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.border}`, marginBottom: 18, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#FF5F57", boxShadow: "0 0 6px rgba(255,95,87,0.5)" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#FFBD2E", boxShadow: "0 0 6px rgba(255,189,46,0.5)" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#28C840", boxShadow: "0 0 6px rgba(40,200,64,0.5)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", fontFamily: "'DM Mono', monospace" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.accent, animation: "pulseDot 2s ease infinite", display: "inline-block" }} />
            DEADSWITCH OS
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 100px", gap: 12, alignItems: "stretch", marginBottom: 14 }}>
          <div style={{ borderRadius: 16, background: t.bg, border: `1px solid ${t.border}`, padding: isMobile ? 16 : 18 }}>
            <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", margin: "0 0 10px", fontFamily: "'DM Mono', monospace" }}>CURRENT PLAN</p>
            <h2 style={{ color: nextSwitch ? t.text : t.textMuted, fontSize: isMobile ? 20 : 24, lineHeight: 1.1, margin: "0 0 8px", letterSpacing: "-0.03em", fontWeight: 900 }}>{nextSwitch ? nextSwitch.label : "No plan yet"}</h2>
            <p style={{ color: t.textSub, fontSize: 11, margin: 0, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextSwitch ? `USDC → ${truncateWallet(nextSwitch.destination)}` : "Create a backup plan to begin"}
            </p>
          </div>
          <div style={{ borderRadius: 16, background: `linear-gradient(135deg, ${t.accentLow}, ${t.panel})`, border: `1px solid ${t.accent}24`, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: isMobile ? 100 : 0 }}>
            <p style={{ color: t.textMuted, fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", margin: 0, fontFamily: "'DM Mono', monospace" }}>NEXT REMINDER</p>
            <div>
              <p style={{ color: nextSwitch && Number(nextSwitch.remainingSeconds)<=WARNING_SECONDS ? t.warn : t.accent, fontSize: isMobile ? 32 : 38, lineHeight: 1, fontWeight: 900, margin: 0, fontFamily: "'DM Mono', monospace", textShadow: `0 0 20px ${t.accent}40` }}>{nextSwitch ? nextSwitch.remaining : "--"}</p>
              <p style={{ color: t.textMuted, fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", margin: "5px 0 0", fontFamily: "'DM Mono', monospace" }}>{nextSwitch?.timer_unit === "minutes" ? "MIN" : "DAYS"}</p>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}><ProgressBar sw={nextSwitch} remaining={nextSwitch?.remaining||0} days={nextSwitch?.days||1} t={t} /></div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ padding: isMobile ? 12 : 13, borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel }}>
              <row.icon size={14} color={row.color} />
              <p style={{ color: t.textMuted, fontSize: 10, margin: "8px 0 3px", fontWeight: 750, letterSpacing: "0.04em" }}>{row.label}</p>
              <p style={{ color: row.color, fontSize: 13, margin: 0, fontWeight: 850 }}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* SWITCH CARD */
function SwitchCard({ sw, onCheckin, onPause, onCancel, onAlert, onEdit, t }) {
  const meta = statusMeta(sw.status, t);
  const isFinal = sw.status === "cancelled" || sw.status === "triggered";
  const isOnChain = sw.contract_id !== null && sw.contract_id !== undefined;
  const isClose = Number(sw.remainingSeconds) <= WARNING_SECONDS && !isFinal;
  const timerColor = isClose ? t.warn : meta.color;
  return (
    <article style={{ background: `linear-gradient(160deg, ${t.surface}, ${t.panel})`, border: `1px solid ${isClose ? `${t.warn}55` : t.border}`, borderRadius: 20, padding: 20, boxShadow: isClose ? `0 20px 60px ${t.warn}14` : "0 16px 50px rgba(0,0,0,0.10)", position: "relative", overflow: "hidden", backdropFilter: "blur(10px)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${meta.color}50, transparent)` }} />
      <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: `radial-gradient(circle, ${meta.color}07, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <StatusPill status={sw.status} t={t} />
          <h3 style={{ color: t.text, fontSize: 16, lineHeight: 1.2, margin: "12px 0 6px", fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>{sw.label}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: t.accentLow, color: t.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", border: `1px solid ${t.accent}30` }}>USDC</span>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>Arc Testnet</span>
            {sw.send_all ? (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>100% balance</span>
            ) : sw.amount ? (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>{sw.amount} USDC</span>
            ) : null}
            {sw.contract_id !== null && sw.contract_id !== undefined && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.accentLow, color: t.accent, fontSize: 10, fontWeight: 900, border: `1px solid ${t.accent}30` }}>#{sw.contract_id}</span>
            )}
          </div>
          <p style={{ color: t.textSub, fontSize: 11, margin: 0, fontFamily: "'DM Mono', monospace" }}>→ {truncateWallet(sw.destination)}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ color: timerColor, fontSize: 30, lineHeight: 1, margin: 0, fontWeight: 900, fontFamily: "'DM Mono', monospace", textShadow: `0 0 16px ${timerColor}40` }}>{sw.remaining}</p>
          <p style={{ color: t.textMuted, fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>{sw.timer_unit === "minutes" ? "MIN LEFT" : "DAYS LEFT"}</p>
        </div>
      </div>
      <div style={{ margin: "16px 0" }}><ProgressBar sw={sw} remaining={sw.remaining} days={sw.days} t={t} /></div>
      <div style={{ minHeight: 44, padding: 12, borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg }}>
        <p style={{ color: t.textSub, fontSize: 12, lineHeight: 1.6, margin: 0, fontStyle: sw.note ? "italic" : "normal" }}>{sw.note ? `"${sw.note}"` : "No message added."}</p>
      </div>
      {sw.email && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: t.textMuted, fontSize: 11, marginTop: 10, fontFamily: "'DM Mono', monospace" }}>
          <Mail size={11} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sw.email}</span>
        </div>
      )}
      {!isFinal && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onCheckin(sw.id)} style={{ flex: 1, minHeight: 38, border: `1px solid ${t.accent}36`, background: t.accentLow, color: t.accent, borderRadius: 11, fontWeight: 900, fontSize: 12, letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s" }}>CHECK IN</button>
          {sw.email && <IconButton onClick={() => onAlert(sw)} title="Send warning email" t={t} tone="warn"><Mail size={14} /></IconButton>}
          <IconButton onClick={() => onEdit(sw)} title="Edit switch" t={t}><Pencil size={14} /></IconButton>
          {!isOnChain && <IconButton onClick={() => onPause(sw.id)} title={sw.status==="paused" ? "Resume" : "Pause"} t={t}>{sw.status==="paused" ? <Play size={14}/> : <Pause size={14}/>}</IconButton>}
          <IconButton onClick={() => onCancel(sw)} title="Cancel switch" t={t} tone="danger"><X size={14} /></IconButton>
        </div>
      )}
    </article>
  );
}

/* SWITCH MODAL */
function SwitchModal({ onClose, onSubmit, initialSwitch, t, isConnected }) {
  const isOnChainEdit = initialSwitch?.contract_id !== null && initialSwitch?.contract_id !== undefined;
  const [form, setForm] = useState({
    label: initialSwitch?.label || "",
    days: initialSwitch?.days || 30,
    timer_unit: initialSwitch?.timer_unit || "days",
    destination: initialSwitch?.destination || "",
    send_all: initialSwitch?.send_all ?? true,
    amount: initialSwitch?.amount || "",
    email: initialSwitch?.email || "",
    note: initialSwitch?.note || "",
  });
  const [saving, setSaving] = useState(false);
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const ok = form.label.trim() && form.destination.trim() && Number(form.days) > 0 && (form.send_all || form.amount);
  const inp = { width: "100%", border: `1px solid ${t.border}`, background: t.bg, color: t.text, borderRadius: 12, padding: "12px 13px", outline: "none", fontSize: 14 };
  const lbl = { color: t.textMuted, display: "block", fontSize: 10, letterSpacing: "0.14em", fontWeight: 900, margin: "16px 0 7px", fontFamily: "'DM Mono', monospace" };
  async function submit() { if (!ok || saving) return; setSaving(true); await onSubmit(form, balance); setSaving(false); }
  return (
    <div onClick={(e) => e.target===e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(20px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", borderRadius: 24, border: `1px solid ${t.borderUp}`, background: t.surface, boxShadow: t.shadow, padding: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)` }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p style={{ color: t.accent, fontSize: 10, letterSpacing: "0.16em", fontWeight: 900, margin: 0, fontFamily: "'DM Mono', monospace" }}>{initialSwitch ? "EDIT PLAN" : "NEW BACKUP PLAN"}</p>
            <h2 style={{ color: t.text, fontSize: 22, margin: "8px 0 0", letterSpacing: "-0.03em", fontWeight: 900 }}>{initialSwitch ? "Update your plan" : "Tell DeadSwitch what to do"}</h2>
          </div>
          <IconButton onClick={onClose} title="Close" t={t}><X size={15} /></IconButton>
        </div>
        {!isConnected && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.warnLow, border: `1px solid ${t.warn}40`, color: t.warn, fontSize: 12, fontWeight: 700 }}>⚠️ Connect your wallet to deploy this switch on-chain</div>}
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.accentLow, border: `1px solid ${t.accent}30`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: t.accent, flexShrink: 0, boxShadow: `0 0 6px ${t.accent}` }} />
          <span style={{ color: t.accent, fontSize: 11, fontWeight: 800, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>Arc Testnet · USDC</span>
        </div>
        {isOnChainEdit && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.warnLow, border: `1px solid ${t.warn}36`, color: t.warn, fontSize: 12, fontWeight: 750, lineHeight: 1.5 }}>This switch is on-chain. You can edit the label, alert email, and note. To change wallet, amount, or timer — cancel and create a new one.</div>}
        <label style={lbl}>PLAN LABEL</label>
        <input style={inp} value={form.label} placeholder="e.g. Emergency recovery" onChange={(e) => set("label", e.target.value)} />
        <label style={lbl}>CHECK-IN TIMER</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {["days", "minutes"].map((unit) => (
            <button key={unit} disabled={isOnChainEdit} onClick={() => set("timer_unit", unit)} style={{ padding: "10px 0", borderRadius: 11, border: `1px solid ${form.timer_unit===unit ? `${t.accent}60` : t.border}`, background: form.timer_unit===unit ? t.accentLow : t.bg, color: form.timer_unit===unit ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.5 : 1, fontWeight: 850, fontSize: 13, textTransform: "capitalize" }}>{unit}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {TIMER_PRESETS[form.timer_unit].map((d) => (
            <button key={d} disabled={isOnChainEdit} onClick={() => set("days", d)} style={{ padding: "10px 0", borderRadius: 10, border: `1px solid ${Number(form.days)===d ? `${t.accent}60` : t.border}`, background: Number(form.days)===d ? t.accentLow : t.bg, color: Number(form.days)===d ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.5 : 1, fontWeight: 800, fontSize: 12 }}>{d}{form.timer_unit === "minutes" ? "m" : "d"}</button>
          ))}
        </div>
        <input disabled={isOnChainEdit} style={{ ...inp, marginTop: 8, opacity: isOnChainEdit ? 0.5 : 1 }} type="number" min="1" max={form.timer_unit === "minutes" ? "10080" : "3650"} value={form.days} placeholder={`Custom ${form.timer_unit}`} onChange={(e) => set("days", e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 7px" }}>
          <span style={{ color: t.textMuted, fontSize: 10, letterSpacing: "0.14em", fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>AMOUNT (USDC)</span>
          {balance && address ? <span style={{ color: t.accent, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>Balance: {parseFloat(balance.formatted).toFixed(2)} {balance.symbol}</span> : <span style={{ color: t.textMuted, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Connect wallet to see balance</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <button disabled={isOnChainEdit} onClick={() => set("send_all", true)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${form.send_all ? `${t.accent}60` : t.border}`, background: form.send_all ? t.accentLow : t.bg, color: form.send_all ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.5 : 1, fontWeight: 800, fontSize: 13 }}>100% of balance</button>
          <button disabled={isOnChainEdit} onClick={() => set("send_all", false)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${!form.send_all ? `${t.accent}60` : t.border}`, background: !form.send_all ? t.accentLow : t.bg, color: !form.send_all ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.5 : 1, fontWeight: 800, fontSize: 13 }}>Specific amount</button>
        </div>
        {!form.send_all && <input disabled={isOnChainEdit} style={{ ...inp, opacity: isOnChainEdit ? 0.5 : 1 }} type="number" min="0" step="any" value={form.amount} placeholder="Amount in USDC" onChange={(e) => set("amount", e.target.value)} />}
        <label style={lbl}>BACKUP WALLET ADDRESS</label>
        <input disabled={isOnChainEdit} style={{ ...inp, fontFamily: "'DM Mono', monospace", opacity: isOnChainEdit ? 0.5 : 1 }} value={form.destination} placeholder="0x..." onChange={(e) => set("destination", e.target.value)} />
        <label style={lbl}>ALERT EMAIL</label>
        <input style={inp} type="email" value={form.email} placeholder="you@example.com (warned when close)" onChange={(e) => set("email", e.target.value)} />
        <label style={lbl}>PERSONAL MESSAGE TO RECIPIENT</label>
        <textarea style={{ ...inp, minHeight: 90, lineHeight: 1.6, resize: "none" }} value={form.note} placeholder="A note for whoever receives this — optional." onChange={(e) => set("note", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: 13, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: "pointer", fontWeight: 750 }}>Cancel</button>
          <button onClick={submit} style={{ padding: 13, borderRadius: 12, border: "none", background: ok ? "linear-gradient(135deg, #00D4A8, #6B7FFF)" : t.surfaceUp, color: ok ? "#000" : t.textMuted, cursor: ok ? "pointer" : "default", fontWeight: 900, boxShadow: ok ? "0 4px 20px rgba(0,212,168,0.22)" : "none", transition: "all 0.2s" }}>
            {saving ? "Deploying on-chain..." : initialSwitch ? "Save changes" : "Deploy backup plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* HOW IT WORKS MODAL */
function HowItWorksModal({ onClose, onCreateClick, t }) {
  const steps = [
    { step: "01", title: "Create a backup plan",      desc: "Set a destination wallet, pick a days or minutes check-in timer, and enter the USDC amount. Your switch deploys on Arc testnet." },
    { step: "02", title: "Check in regularly",         desc: "As long as you check in before your timer runs out, nothing happens. One tap resets the clock on-chain." },
    { step: "03", title: "Go silent — it activates",   desc: "If you stop checking in, the executor triggers your contract and sends USDC to your backup address. No middleman." },
    { step: "04", title: "Get warned before it fires", desc: "Add your email and DeadSwitch will warn you when the deadline is close. You'll never be caught off guard." },
  ];
  return (
    <div onClick={(e) => e.target===e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(20px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,13,22,0.97)", boxShadow: "0 40px 120px rgba(0,0,0,0.70)", padding: 28, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,168,0.45), transparent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <p style={{ color: t.accent, fontSize: 10, letterSpacing: "0.16em", fontWeight: 900, margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>DEADSWITCH</p>
            <h2 style={{ color: "#F0F4FF", fontSize: 24, margin: 0, letterSpacing: "-0.03em", lineHeight: 1.1, fontWeight: 900 }}>How it works</h2>
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 13, margin: "6px 0 0" }}>Four steps. Fully automatic.</p>
          </div>
          <IconButton onClick={onClose} title="Close" t={t}><X size={15} /></IconButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,212,168,0.08)", border: "1px solid rgba(0,212,168,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: t.accent, fontSize: 11, fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>{item.step}</span>
              </div>
              <div>
                <p style={{ color: "#F0F4FF", fontSize: 15, fontWeight: 800, margin: "0 0 5px", letterSpacing: "-0.01em" }}>{item.title}</p>
                <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "24px 0" }} />
        <button onClick={() => { onClose(); onCreateClick(); }}
          style={{ width: "100%", padding: "14px 0", background: "linear-gradient(135deg, #00D4A8, #6B7FFF)", border: "none", borderRadius: 14, color: "#000", fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,212,168,0.22)", transition: "opacity 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.opacity="0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity="1"}>
          Create my first backup plan →
        </button>
      </div>
    </div>
  );
}

/* MAIN APP */
export default function DeadSwitch() {
  const [dark, setDark] = useState(true);
  const [session, setSession] = useState(undefined);
  const [resetMode, setResetMode] = useState(false);
  const [switches, setSwitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHowIt, setShowHowIt] = useState(false);
  const [editingSwitch, setEditingSwitch] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionPrompt, setSubscriptionPrompt] = useState("");
  const [subscribing, setSubscribing] = useState(null);
  const [now, setNow] = useState(null);
  const [width, setWidth] = useState(1024);
  const t = dark ? D : L;

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const isRecovery = url.searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery" || url.searchParams.has("code");
    if (isRecovery) requestAnimationFrame(() => setResetMode(true));
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && !localStorage.getItem(`deadswitch-plan-picked-${session.user.id}`)) {
        requestAnimationFrame(() => {
          setSubscriptionPrompt("");
          setShowSubscription(true);
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) {
        setSwitches([]);
        setShowSubscription(false);
      } else if (!localStorage.getItem(`deadswitch-plan-picked-${session.user.id}`)) {
        requestAnimationFrame(() => {
          setSubscriptionPrompt("");
          setShowSubscription(true);
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadSwitches() {
      if (!session) { requestAnimationFrame(() => { if (!ignore) setLoading(false); }); return; }
      const { data, error } = await supabase.from("switches").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (!ignore) { if (error) showToast(error.message); if (data) setSwitches(data); setLoading(false); }
    }
    loadSwitches();
    return () => { ignore = true; };
  }, [session]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setNow(new Date()); setWidth(window.innerWidth); });
    const tick = setInterval(() => setNow(new Date()), 1000);
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); clearInterval(tick); window.removeEventListener("resize", resize); };
  }, []);

  const loadSubscription = useCallback(async () => {
    if (!address || !publicClient || !CONTRACT_ADDRESS) {
      setSubscription(null);
      return;
    }

    try {
      const [sub, activeCount] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getSubscription",
          args: [address],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "activeSwitchCount",
          args: [address],
        }),
      ]);

      setSubscription({
        tier: Number(sub[0]),
        expiresAt: Number(sub[1]),
        maxSwitches: Number(sub[2]) > 1000000 ? YEARLY_MAX_SWITCHES : Number(sub[2]),
        maxTimer: Number(sub[3]),
        activeSwitchCount: Number(activeCount),
      });
      if (Number(sub[0]) > 0 && session?.user?.id) {
        localStorage.setItem(`deadswitch-plan-picked-${session.user.id}`, "paid");
        setShowSubscription(false);
      }
    } catch (err) {
      console.error("Subscription load error:", err);
      setSubscription(null);
    }
  }, [address, publicClient, session?.user?.id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadSubscription();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadSubscription]);

  const isMobile = width < 700;
  const isTablet = width < 980;
  const px = isMobile ? 18 : width < 1180 ? 28 : 40;
  const heroTitleSize = isMobile ? "clamp(38px,11vw,54px)" : isTablet ? "clamp(50px,7.5vw,68px)" : "clamp(56px,5vw,74px)";
  const timedSwitches = useMemo(() => switches.map((sw) => withLiveTimer(sw, now || new Date())), [switches, now]);
  const activeSwitches = useMemo(() => timedSwitches.filter((s) => s.status !== "cancelled" && s.status !== "triggered"), [timedSwitches]);
  const historySwitches = useMemo(() => timedSwitches.filter((s) => s.status === "cancelled" || s.status === "triggered"), [timedSwitches]);
  const active = activeSwitches.filter((s) => s.status !== "paused").length;
  const warnings = activeSwitches.filter((s) => s.status === "warning" || Number(s.remainingSeconds) <= WARNING_SECONDS).length;
  const nextSwitch = useMemo(() => activeSwitches.filter((s) => s.status !== "paused").slice().sort((a, b) => Number(a.remaining) - Number(b.remaining))[0], [activeSwitches]);
  const currentTier = tierById(subscription?.tier || 0);
  const planMaxSwitches = subscription?.maxSwitches ?? currentTier.switches;
  const planMaxTimer = subscription?.maxTimer ?? currentTier.maxTimerSeconds;
  const planActiveCount = subscription?.activeSwitchCount ?? activeSwitches.length;

  function showToast(msg, timeout = 3600) { setAlertMsg(msg); setTimeout(() => setAlertMsg(null), timeout); }
  async function handleSignOut() { await supabase.auth.signOut(); showToast("Signed out"); }
  function openSubscription(prompt = "") {
    setSubscriptionPrompt(prompt);
    setShowSubscription(true);
  }
  function closeSubscription() {
    setSubscriptionPrompt("");
    setShowSubscription(false);
  }
  function openCreateSwitch() {
    if (planActiveCount >= planMaxSwitches) {
      openSubscription(`Your ${currentTier.name} plan allows ${formatMaxSwitches(planMaxSwitches)} active switch${planMaxSwitches === 1 ? "" : "es"}. Upgrade to create more switches at the same time.`);
      return;
    }
    setEditingSwitch(null);
    setShowModal(true);
  }

  async function subscribeToTier(tier) {
    if (tier.id === 0) {
      if (session?.user?.id) localStorage.setItem(`deadswitch-plan-picked-${session.user.id}`, "free");
      closeSubscription();
      showToast("Free plan is active by default");
      return;
    }
    if (!CONTRACT_ADDRESS) return showToast("Contract address is missing.");
    if (!isConnected || !walletClient || !publicClient) {
      openConnectModal?.();
      return showToast("Connect your wallet to subscribe");
    }

    try {
      setSubscribing(tier.id);
      const price = parseUnits(String(tier.price), 6);

      showToast(`Approve ${tier.price} USDC for ${tier.name}...`);
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, price],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      showToast(`Activating ${tier.name} plan...`);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "subscribe",
        args: [tier.id],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await loadSubscription();
      if (session?.user?.id) localStorage.setItem(`deadswitch-plan-picked-${session.user.id}`, tier.key);
      closeSubscription();
      showToast(`${tier.name} plan activated`);
    } catch (err) {
      console.error("Subscription error:", err);
      showToast("Subscription failed — nothing was changed", 5200);
    } finally {
      setSubscribing(null);
    }
  }

  async function sendSwitchEmail(sw, type = "warning") {
    if (!sw.email) return { ok: true };
    const res = await fetch("/api/send-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sw.email, label: sw.label, remaining: sw.remaining, type }) });
    const json = await res.json();
    return { ok: res.ok, json };
  }

  async function createSwitch(form, balance) {
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1");
    const timerUnit = form.timer_unit || "days";
    const timerSeconds = timerUnit === "minutes" ? days * 60 : days * 86400;
    if (!CONTRACT_ADDRESS) return showToast("Contract address is missing.");
    if (!isConnected || !walletClient || !publicClient) return showToast("Connect your wallet before creating a backup plan");
    if (subscription) {
      if (subscription.activeSwitchCount >= subscription.maxSwitches) {
        setShowModal(false);
        openSubscription(`You’ve reached the active switch limit on ${currentTier.name}. Upgrade to unlock more active switches, or cancel an old one to free a slot.`);
        return showToast("Upgrade to create more active switches.");
      }
      if (timerSeconds > subscription.maxTimer) {
        setShowModal(false);
        openSubscription(`This timer is above your ${currentTier.name} limit. Your current max is ${formatMaxTimer(subscription.maxTimer)}. Upgrade to set longer backup timers.`);
        return showToast("Upgrade to use a longer timer.");
      }
    }
    let contract_id = null, tx_hash = null;
    try {
      let usdcAmount;
      if (form.send_all && balance) { usdcAmount = parseUnits(parseFloat(balance.formatted).toFixed(6), 6); }
      else if (form.amount) { usdcAmount = parseUnits(String(Number(form.amount).toFixed(6)), 6); }
      else return showToast("Please enter a USDC amount");
      if (usdcAmount <= 0n) return showToast("USDC amount must be greater than zero");
      showToast("Step 1/2 — Approve USDC... confirm in wallet");
      const approveHash = await walletClient.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [CONTRACT_ADDRESS, usdcAmount] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      showToast("Approved ✅ Step 2/2 — Deploying switch...");
      const hash = await walletClient.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "createSwitch", args: [form.destination, usdcAmount, BigInt(timerSeconds)] });
      showToast("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      tx_hash = hash;
      const switchCreatedLogs = parseEventLogs({ abi: CONTRACT_ABI, logs: receipt.logs, eventName: "SwitchCreated" });
      const switchId = switchCreatedLogs[0]?.args?.id;
      if (switchId === undefined) throw new Error("SwitchCreated event was not found in the transaction receipt");
      contract_id = switchId.toString();
      showToast("On-chain deployment confirmed! ✅");
    } catch (err) { console.error("Contract error:", err); return showToast("On-chain deploy failed — backup plan was not saved", 5200); }
    const { data, error } = await supabase.from("switches").insert([{ label: form.label, days, remaining: days, timer_unit: timerUnit, destination: form.destination, chain: "Arc Testnet", token: "USDC", send_all: form.send_all, amount: form.send_all ? null : form.amount, note: form.note, email: form.email || null, status: "active", user_id: session.user.id, contract_id, tx_hash }]).select().single();
    if (error) return showToast(error.message || "Failed to create switch");
    setSwitches((p) => [data, ...p]);
    setShowModal(false);
    await loadSubscription();
    showToast(contract_id !== null ? `Deployed on-chain! Switch #${contract_id}` : "Backup plan created");
    if (data.email) sendSwitchEmail(data, "created");
  }

  async function updateSwitch(form) {
    if (!editingSwitch) return;
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1");
    const timerUnit = form.timer_unit || "days";
    const timerSeconds = timerUnit === "minutes" ? days * 60 : days * 86400;
    const isOnChain = editingSwitch.contract_id !== null && editingSwitch.contract_id !== undefined;
    if (!isOnChain && subscription && timerSeconds > subscription.maxTimer) {
      setShowModal(false);
      openSubscription(`This timer is above your ${currentTier.name} limit. Your current max is ${formatMaxTimer(subscription.maxTimer)}. Upgrade to extend switches further.`);
      return showToast("Upgrade to use a longer timer.");
    }
    const updatePayload = isOnChain ? { label: form.label, note: form.note, email: form.email || null } : { label: form.label, days, remaining: days, timer_unit: timerUnit, destination: form.destination, chain: "Arc Testnet", token: "USDC", send_all: form.send_all, amount: form.send_all ? null : form.amount, note: form.note, email: form.email || null, status: editingSwitch.status === "triggered" ? "active" : editingSwitch.status, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("switches").update(updatePayload).eq("id", editingSwitch.id).select().single();
    if (error) return showToast(error.message || "Failed to update switch");
    setSwitches((p) => p.map((sw) => sw.id === editingSwitch.id ? data : sw));
    setEditingSwitch(null); setShowModal(false);
    showToast(isOnChain ? "Plan details updated" : "Backup plan updated");
  }

  async function checkIn(id) {
    const sw = switches.find((s) => s.id === id); if (!sw) return;
    if (sw.contract_id !== null && sw.contract_id !== undefined) {
      if (!isConnected || !walletClient || !publicClient) return showToast("Connect the wallet that created this switch to check in on-chain");
      try {
        showToast("Checking in on-chain... confirm in wallet");
        const hash = await walletClient.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "checkIn", args: [BigInt(sw.contract_id), BigInt(durationSeconds(sw))] });
        await publicClient.waitForTransactionReceipt({ hash });
        showToast("On-chain check-in confirmed ✅");
      } catch (err) { console.error("Check-in error:", err); return showToast("On-chain check-in failed — nothing was changed", 5200); }
    }
    const { data, error } = await supabase.from("switches").update({ remaining: sw.days, status: "active", created_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) return showToast(error.message || "Check-in failed");
    setSwitches((p) => p.map((s) => s.id === id ? data : s));
    if (!sw.contract_id) showToast("Check-in confirmed");
  }

  async function pauseSwitch(id) {
    const sw = switches.find((s) => s.id === id); if (!sw) return;
    const status = sw.status === "paused" ? "active" : "paused";
    const { data, error } = await supabase.from("switches").update({ status }).eq("id", id).select().single();
    if (error) return showToast(error.message || "Status update failed");
    setSwitches((p) => p.map((s) => s.id === id ? data : s));
  }

  async function cancelSwitch(sw) {
    if (sw.contract_id !== null && sw.contract_id !== undefined) {
      if (!isConnected || !walletClient || !publicClient) return showToast("Connect the wallet that created this switch to cancel it on-chain");
      try {
        showToast("Cancelling on-chain... confirm in wallet");
        const hash = await walletClient.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "cancel", args: [BigInt(sw.contract_id)] });
        await publicClient.waitForTransactionReceipt({ hash });
        showToast("USDC returned to your wallet ✅");
      } catch (err) { console.error("Cancel error:", err); return showToast("On-chain cancel failed — plan was not cancelled"); }
    }
    const { data, error } = await supabase.from("switches").update({ status: "cancelled" }).eq("id", sw.id).select().single();
    if (error) return showToast(error.message || "Failed to cancel plan");
    setSwitches((p) => p.map((s) => s.id === sw.id ? data : s));
    await loadSubscription();
    if (sw.email) sendSwitchEmail({ ...sw, status: "cancelled" }, "cancelled");
    showToast("Backup plan cancelled");
  }

  async function sendAlert(sw) {
    showToast("Sending...");
    const result = await sendSwitchEmail(sw, "warning");
    if (result?.json?.error) return showToast(result.json.error, 5200);
    showToast(`Alert sent to ${sw.email}`);
  }

  useEffect(() => {
    timedSwitches.forEach((sw) => {
      if (!sw.email || sw.status !== "active" || Number(sw.remainingSeconds) > WARNING_SECONDS) return;
      const key = `deadswitch-warning-${sw.id}-${sw.remaining}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "sent");
      sendSwitchEmail(sw, "warning");
    });
  }, [timedSwitches]);

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: "#05060A", display: "grid", placeItems: "center" }}>
      <style>{`* { box-sizing:border-box; } body { margin:0; } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(0,212,168,0.15)", borderTopColor: "#00D4A8", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.18)", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em" }}>LOADING</p>
      </div>
    </div>
  );

  if (!session || resetMode) return <AuthScreen t={D} initialMode={resetMode ? "reset" : "signin"} onPasswordResetComplete={() => setResetMode(false)} />;

  return (
    <div style={{ minHeight: "100vh", background: dark ? "radial-gradient(ellipse at 50% 0%, rgba(0,212,168,0.05) 0%, transparent 50%), linear-gradient(160deg, #05060A 0%, #0A0C14 100%)" : `linear-gradient(160deg, ${t.bg} 0%, ${t.bg2} 100%)`, color: t.text, transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,650;0,9..40,800;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; } body { margin:0; }
        button, input, select, textarea { font-family:'DM Sans',sans-serif; }
        button { min-width:0; } input, select, textarea { max-width:100%; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.32;transform:scale(.76)} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {alertMsg && (
        <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 300, display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 16, background: t.surface, color: t.text, border: `1px solid ${t.accent}30`, boxShadow: t.shadow, fontSize: 13, fontWeight: 750, backdropFilter: "blur(20px)", animation: "fadeUp 0.3s ease" }}>
          <Bell size={14} color={t.accent} />{alertMsg}
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: `0 ${px}px`, borderBottom: `1px solid ${t.border}`, backdropFilter: "blur(24px)", background: dark ? "rgba(5,6,10,0.90)" : "rgba(244,246,242,0.92)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <DSLogo t={t} size={40} />
            <div>
              <p style={{ color: t.text, fontWeight: 900, margin: 0, fontSize: 15, letterSpacing: "-0.02em" }}>DeadSwitch</p>
              {!isMobile && <p style={{ color: t.textMuted, margin: "1px 0 0", fontSize: 10, letterSpacing: "0.06em", fontFamily: "'DM Mono',monospace" }}>{session.user.email}</p>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                <Clock size={11} />{now ? now.toLocaleTimeString() : "--:--:--"}
              </div>
            )}
            <div style={{ "--rk-radii-connectButton": "12px" }}>
              <ConnectButton showBalance={false} chainStatus={isMobile ? "none" : "icon"} accountStatus={isMobile ? "avatar" : "full"} />
            </div>
            <button
              onClick={() => openSubscription("Upgrade anytime to unlock more active switches and longer timers.")}
              title="View or upgrade plan"
              style={{ minHeight: 38, padding: "0 13px", borderRadius: 12, border: `1px solid ${t.accent}30`, background: t.accentLow, color: t.accent, cursor: "pointer", fontWeight: 900, fontSize: 12, fontFamily: "'DM Mono',monospace", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", lineHeight: 1.15 }}
            >
              <span>{currentTier.name}</span>
              {!isMobile && <span style={{ color: t.textMuted, fontSize: 9 }}>{planActiveCount}/{formatMaxSwitches(planMaxSwitches)} active</span>}
            </button>
            <button onClick={() => setDark((v) => !v)} style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 12, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, cursor: "pointer" }}>
              {dark ? <Sun size={15}/> : <Moon size={15}/>}
            </button>
            <IconButton onClick={handleSignOut} title="Sign out" t={t} tone="danger"><LogOut size={14} /></IconButton>
          </div>
        </div>
      </nav>

      {isConnected && address && (
        <div style={{ background: "rgba(0,212,168,0.04)", borderBottom: "1px solid rgba(0,212,168,0.08)", padding: `8px ${px}px` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, color: t.accent, fontSize: 11, fontWeight: 750, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.accent, display: "inline-block", animation: "pulseDot 2s ease infinite", boxShadow: `0 0 6px ${t.accent}` }} />
            {truncateWallet(address)} · Arc Testnet · USDC
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: `${isMobile ? 36 : 64}px ${px}px 100px` }}>
        {showSubscription && (
        <SubscriptionPanel
          subscription={subscription}
          onSubscribe={subscribeToTier}
          subscribing={subscribing}
          isConnected={isConnected}
          t={t}
          dark={dark}
          isMobile={isMobile}
          onClose={closeSubscription}
          prompt={subscriptionPrompt}
        />
        )}

        <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) minmax(460px,580px)", gap: isTablet ? 32 : 64, alignItems: "start", animation: "fadeUp .5s ease" }}>
          <div style={{ maxWidth: isTablet ? 760 : 560, paddingTop: isTablet ? 0 : 14 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(0,212,168,0.18)", background: "rgba(0,212,168,0.06)", color: t.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", marginBottom: 28, fontFamily: "'DM Mono', monospace" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: t.accent, animation: "pulseDot 2s ease infinite", boxShadow: `0 0 6px ${t.accent}` }} />
              CRYPTO BACKUP AGENT · ARC TESTNET
            </div>
            <h1 style={{ color: t.text, fontSize: heroTitleSize, lineHeight: 0.96, letterSpacing: "-0.052em", margin: "0 0 26px", fontWeight: 900, maxWidth: 580 }}>
              Life happens.<br />
              <span style={{ background: "linear-gradient(135deg, #00D4A8 30%, #6B7FFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Your crypto</span><br />
              should know<br />
              what to do.
            </h1>
            <p style={{ color: t.textSub, fontSize: isMobile ? 15 : 17, lineHeight: 1.72, maxWidth: 460, margin: "0 0 34px" }}>
              Choose a backup wallet, set a check-in timer, and let DeadSwitch handle the rest — automatically, on-chain.
            </p>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginBottom: 40, maxWidth: isMobile ? "100%" : 520 }}>
              <button onClick={openCreateSwitch}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #00D4A8, #6B7FFF)", color: "#000", fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 30px rgba(0,212,168,0.22)", width: isMobile ? "100%" : "auto", fontSize: 14, letterSpacing: "-0.01em", transition: "opacity 0.2s, transform 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity="0.88"; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="translateY(0)"; }}>
                <Plus size={16}/>Create my backup plan
              </button>
              <button onClick={() => setShowHowIt(true)}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontWeight: 800, cursor: "pointer", width: isMobile ? "100%" : "auto", transition: "all 0.2s", fontSize: 14 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(0,212,168,0.28)"; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textSub; }}>
                <LockKeyhole size={15}/>How it works<ChevronRight size={14}/>
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(3,minmax(0,130px))", gap: 10, maxWidth: 430 }}>
              {[["Plans", active, t.accent], ["Due soon", warnings, warnings > 0 ? t.warn : t.accent], ["Network", "Arc", t.accent2]].map(([label, value, color]) => (
                <div key={label} style={{ padding: "15px 14px", borderRadius: 16, border: `1px solid ${t.border}`, background: t.panel, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}35, transparent)` }} />
                  <p style={{ color: color, fontSize: isMobile ? 24 : 28, fontWeight: 900, margin: 0, letterSpacing: "-0.04em", fontFamily: "'DM Mono', monospace" }}>{value}</p>
                  <p style={{ color: t.textMuted, fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", margin: "5px 0 0", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace" }}>{String(label).toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", justifyContent: isTablet ? "flex-start" : "flex-end", alignSelf: "start", paddingTop: isTablet ? 0 : 8 }}>
            <AgentConsole switches={activeSwitches} nextSwitch={nextSwitch} t={t} isMobile={isMobile} />
          </div>
        </section>

        <section style={{ marginTop: isMobile ? 56 : 88 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 24 }}>
            <div>
              <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 900, letterSpacing: "0.16em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>YOUR PLANS</p>
              <h2 style={{ color: t.text, fontSize: isMobile ? 24 : 30, margin: 0, letterSpacing: "-0.04em", fontWeight: 900 }}>Backup plans</h2>
            </div>
            <button onClick={openCreateSwitch}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,212,168,0.22)", background: "rgba(0,212,168,0.07)", color: t.accent, cursor: "pointer", fontWeight: 850, fontSize: 13, transition: "all 0.2s" }}>
              <Plus size={14}/>New
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: t.textSub, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.10em" }}>LOADING...</div>
          ) : activeSwitches.length ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 14 }}>
              {activeSwitches.map((sw) => (
                <SwitchCard key={sw.id} sw={sw} onCheckin={checkIn} onPause={pauseSwitch} onCancel={cancelSwitch} onAlert={sendAlert} onEdit={(item) => { setEditingSwitch(item); setShowModal(true); }} t={t} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 24, border: `1px solid ${t.border}`, background: t.panel, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(0,212,168,0.03), transparent 70%)", pointerEvents: "none" }} />
              <Shield size={38} color={t.textMuted} />
              <h3 style={{ color: t.text, margin: "18px 0 8px", fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>No backup plans yet</h3>
              <p style={{ color: t.textSub, margin: "0 0 24px", fontSize: 14 }}>Create your first plan and let DeadSwitch start watching.</p>
              <button onClick={openCreateSwitch}
                style={{ padding: "12px 20px", borderRadius: 13, border: "none", background: "linear-gradient(135deg, #00D4A8, #6B7FFF)", color: "#000", cursor: "pointer", fontWeight: 900, fontSize: 13, boxShadow: "0 4px 20px rgba(0,212,168,0.18)" }}>
                Create backup plan
              </button>
            </div>
          )}
        </section>

        <section style={{ marginTop: isMobile ? 44 : 60 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 20 }}>
            <div>
              <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 900, letterSpacing: "0.16em", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>HISTORY</p>
              <h2 style={{ color: t.text, fontSize: isMobile ? 20 : 26, margin: 0, letterSpacing: "-0.04em", fontWeight: 900 }}>Executed & cancelled</h2>
            </div>
            <span style={{ color: t.textMuted, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{historySwitches.length} archived</span>
          </div>
          {historySwitches.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {historySwitches.map((sw) => (
                <div key={sw.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: sw.status === "triggered" ? t.accentLow : t.surfaceUp, border: `1px solid ${sw.status === "triggered" ? `${t.accent}30` : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {sw.status === "triggered" ? <Zap size={14} color={t.accent} /> : <X size={14} color={t.textMuted} />}
                    </div>
                    <div>
                      <p style={{ color: t.text, fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: "-0.01em" }}>{sw.label}</p>
                      <p style={{ color: t.textSub, fontSize: 11, margin: "3px 0 0", fontFamily: "'DM Mono', monospace" }}>→ {truncateWallet(sw.destination)}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <StatusPill status={sw.status} t={t} />
                    <p style={{ color: t.textMuted, fontSize: 10, margin: "6px 0 0", fontFamily: "'DM Mono', monospace" }}>{new Date(sw.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "22px 20px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
              NO HISTORY YET
            </div>
          )}
        </section>
      </main>

      <footer style={{ padding: `20px ${px}px`, borderTop: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: t.textMuted, fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
          <span>DEADSWITCH</span>
          <span>ARC TESTNET · USDC · CIRCLE</span>
        </div>
      </footer>

      {showModal && <SwitchModal onClose={() => { setShowModal(false); setEditingSwitch(null); }} onSubmit={editingSwitch ? updateSwitch : createSwitch} initialSwitch={editingSwitch} t={t} isConnected={isConnected} />}
      {showHowIt && <HowItWorksModal onClose={() => setShowHowIt(false)} onCreateClick={openCreateSwitch} t={t} />}
    </div>
  );
} 
