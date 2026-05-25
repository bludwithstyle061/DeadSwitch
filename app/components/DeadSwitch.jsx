"use client";

import { supabase } from "../supabase";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useWalletClient, usePublicClient } from "wagmi";
import { parseEventLogs, parseUnits } from "viem";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Radar,
  Shield,
  Sun,
  X,
  Zap,
} from "lucide-react";

const D = {
  bg: "#07080D", bg2: "#0D1018",
  surface: "rgba(18, 22, 32, 0.78)", surfaceUp: "rgba(27, 33, 47, 0.82)",
  panel: "rgba(11, 13, 20, 0.76)", border: "rgba(255,255,255,0.08)",
  borderUp: "rgba(255,255,255,0.16)", text: "#F4F7FB", textSub: "#A9B1C1",
  textMuted: "#667085", accent: "#00D4A8", accent2: "#7C8CFF",
  accentLow: "rgba(0,212,168,0.10)", accentMid: "rgba(0,212,168,0.18)",
  warn: "#F4B740", warnLow: "rgba(244,183,64,0.11)",
  danger: "#F36B7F", dangerLow: "rgba(243,107,127,0.12)",
  shadow: "0 28px 90px rgba(0,0,0,0.45)",
};

const L = {
  bg: "#F6F7F4", bg2: "#EAEEE8",
  surface: "rgba(255,255,255,0.82)", surfaceUp: "rgba(244,246,242,0.95)",
  panel: "rgba(255,255,255,0.72)", border: "rgba(11,19,32,0.09)",
  borderUp: "rgba(11,19,32,0.16)", text: "#111827", textSub: "#4E5A6D",
  textMuted: "#8B95A7", accent: "#008F73", accent2: "#4657D8",
  accentLow: "rgba(0,143,115,0.09)", accentMid: "rgba(0,143,115,0.16)",
  warn: "#B7791F", warnLow: "rgba(183,121,31,0.10)",
  danger: "#C8354B", dangerLow: "rgba(200,53,75,0.10)",
  shadow: "0 28px 80px rgba(23,32,48,0.12)",
};

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
];

const TIMER_PRESETS = {
  minutes: [1, 2, 5, 10, 30, 60],
  days: [2, 5, 30, 60, 90, 180],
};
const WARNING_SECONDS = 2 * 60;

function truncateWallet(value = "") {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function timerUnit(sw) {
  return sw?.timer_unit || "days";
}

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
  if (value <= 0) return "READY TO EXECUTE";
  return `${value} ${unit === "minutes" ? "MIN" : value === 1 ? "DAY" : "DAYS"} REMAINING`;
}

function statusMeta(status, t) {
  const map = {
    active:    { label: "Watching",       color: t.accent,    bg: t.accentLow,  Icon: Radar },
    warning:   { label: "Deadline close", color: t.warn,      bg: t.warnLow,    Icon: AlertTriangle },
    paused:    { label: "Paused",         color: t.textMuted, bg: t.surfaceUp,  Icon: Pause },
    triggered: { label: "Triggered",      color: t.danger,    bg: t.dangerLow,  Icon: Zap },
  };
  return map[status] || map.active;
}

function DSLogo({ size = 34, t }) {
  const s = size;
  const cx = s * 0.5, cy = s * 0.5;
  const pillW = s * 0.72, pillH = s * 0.33;
  const pillX = cx - pillW / 2, pillY = cy - pillH / 2;
  const r = pillH / 2, dotR = r * 0.72;
  const leftDot = pillX + r, rightDot = pillX + pillW - r;
  const px2 = pillX - 2;
  const pts = [
    [0, cy], [px2 * 0.35, cy], [px2 * 0.52, cy - s * 0.22],
    [px2 * 0.68, cy + s * 0.22], [px2 * 0.84, cy], [px2, cy],
  ].map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} fill="none" aria-hidden="true">
        <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={r} stroke={t.accent} strokeWidth={s * 0.055} />
        <circle cx={leftDot} cy={cy} r={dotR} fill={t.accent} opacity="0.2" />
        <circle cx={rightDot} cy={cy} r={dotR * 1.05} fill={t.accent} />
        <circle cx={rightDot} cy={cy} r={dotR * 1.6} fill={t.accent} opacity="0.12" />
        <polyline points={pts} stroke={t.accent} strokeWidth={s * 0.048} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={pillX + pillW + 2} y1={cy} x2={s} y2={cy} stroke={t.accent} strokeWidth={s * 0.048} strokeLinecap="round" opacity="0.35" />
      </svg>
      <span style={{ position: "absolute", inset: -4, borderRadius: 18, boxShadow: `0 0 28px ${t.accent}20`, pointerEvents: "none" }} />
    </div>
  );
}

function IconButton({ children, title, onClick, t, tone = "neutral" }) {
  const color = tone === "danger" ? t.danger : tone === "warn" ? t.warn : t.textSub;
  const bg    = tone === "danger" ? t.dangerLow : tone === "warn" ? t.warnLow : t.surfaceUp;
  return (
    <button onClick={onClick} title={title} style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${t.border}`, background: bg, color, cursor: "pointer", display: "grid", placeItems: "center" }}>
      {children}
    </button>
  );
}

function StatusPill({ status, t }) {
  const meta = statusMeta(status, t);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}24`, fontSize: 11, fontWeight: 800, letterSpacing: "0.02em" }}>
      <meta.Icon size={12} strokeWidth={2.4} />{meta.label}
    </span>
  );
}

function ProgressBar({ sw, remaining, days, t }) {
  const total = sw ? durationSeconds(sw) : Number(days || 1);
  const left = sw ? Number(sw.remainingSeconds || 0) : Number(remaining || 0);
  const pct   = Math.max(0, Math.min(100, (left / Number(total || 1)) * 100));
  const color = pct <= 15 ? t.danger : pct <= 35 ? t.warn : t.accent;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 7 }}>
        <strong style={{ color, fontSize: 13, letterSpacing: "0.03em", fontWeight: 950 }}>
          {sw ? timerLabel(sw) : Number(remaining) <= 0 ? "READY TO EXECUTE" : `${remaining} REMAINING`}
        </strong>
        <span style={{ color: t.textMuted, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: t.surfaceUp, overflow: "hidden", border: `1px solid ${t.border}` }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${t.accent2})`, boxShadow: `0 0 18px ${color}55`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

/* ── AUTH ────────────────────────────────────────────────────── */
function AuthScreen({ t, initialMode = "signin", onPasswordResetComplete }) {
  const [mode, setMode]         = useState(initialMode);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);
  const [error, setError]       = useState(null);
  const inp = { width: "100%", border: `1px solid ${t.border}`, background: t.bg, color: t.text, borderRadius: 12, padding: "12px 14px", outline: "none", fontSize: 14, boxSizing: "border-box" };

  useEffect(() => {
    let ignore = false;

    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
      const isRecovery = url.searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery" || initialMode === "reset";
      const code = url.searchParams.get("code");

      if (!isRecovery) return;

      setMode("reset");
      setError(null);
      setMessage("Preparing secure password reset...");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (ignore) return;
        if (error) {
          setError(error.message);
          setMessage(null);
          return;
        }
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?type=recovery`,
    });
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
    else {
      setMessage("Password updated. You can continue to your dashboard.");
      setPassword("");
      setConfirmPassword("");
      onPasswordResetComplete?.();
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(140deg, ${t.bg}, ${t.bg2})`, display: "grid", placeItems: "center", padding: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,650;0,9..40,800;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        button, input { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.4s ease" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <DSLogo size={52} t={t} />
          <h1 style={{ color: t.text, fontSize: 24, fontWeight: 900, margin: "14px 0 4px", letterSpacing: "-0.03em" }}>DeadSwitch</h1>
          <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>Your crypto backup agent</p>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.borderUp}`, borderRadius: 22, padding: 28, boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)` }} />
          {mode !== "forgot" && mode !== "reset" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 24, background: t.bg, borderRadius: 12, padding: 4 }}>
            {[["signin","Sign In"],["signup","Sign Up"],["magic","Magic Link"]].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }} style={{ padding: "8px 0", borderRadius: 9, border: "none", background: mode===m ? t.surface : "transparent", color: mode===m ? t.text : t.textMuted, fontWeight: mode===m ? 800 : 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s", boxShadow: mode===m ? "0 2px 8px rgba(0,0,0,0.12)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode !== "reset" && (
            <div>
              <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>EMAIL</label>
              <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            )}
            {mode !== "magic" && mode !== "forgot" && (
              <div>
                <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>{mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}</label>
                <input style={inp} type="password" placeholder={mode==="signup" || mode==="reset" ? "Min. 6 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key==="Enter" && (mode==="signin" ? handleSignIn() : mode==="signup" ? handleSignUp() : handlePasswordReset())} />
              </div>
            )}
            {mode === "reset" && (
              <div>
                <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>CONFIRM PASSWORD</label>
                <input style={inp} type="password" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handlePasswordReset()} />
              </div>
            )}
          </div>
          {error   && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.dangerLow, border: `1px solid ${t.danger}30`, color: t.danger, fontSize: 13 }}>{error}</div>}
          {message && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.accentLow, border: `1px solid ${t.accent}30`, color: t.accent, fontSize: 13 }}>{message}</div>}
          <button onClick={mode==="signin" ? handleSignIn : mode==="signup" ? handleSignUp : mode==="magic" ? handleMagicLink : mode==="forgot" ? handleForgotPassword : handlePasswordReset} style={{ width: "100%", marginTop: 20, padding: "13px 0", background: t.text, border: "none", borderRadius: 13, color: t.bg, fontSize: 14, fontWeight: 900, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s", letterSpacing: "-0.01em" }}>
            {loading ? "Please wait..." : mode==="signin" ? "Sign in →" : mode==="signup" ? "Create account →" : mode==="magic" ? "Send magic link →" : mode==="forgot" ? "Send reset link →" : "Update password →"}
          </button>
          {mode === "signin" && (
            <button onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>
              Forgot password?
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>
          <p style={{ color: t.textMuted, fontSize: 13, textAlign: "center", margin: 0 }}>
            {mode==="signin" ? <>No account? <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign up</button></> :
             mode==="signup" ? <>Already have an account? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></> :
             <>Remember your password? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></>}
          </p>
        </div>
        <p style={{ color: t.textMuted, fontSize: 11, textAlign: "center", marginTop: 20, fontFamily: "'DM Mono', monospace" }}>DEADSWITCH · BUILT ON ARC TESTNET</p>
      </div>
    </div>
  );
}

/* ── AGENT CONSOLE ───────────────────────────────────────────── */
function AgentConsole({ switches, nextSwitch, t, isMobile }) {
  const active   = switches.filter((s) => s.status==="active" || s.status==="warning").length;
  const warnings = switches.filter((s) => s.status==="warning" || Number(s.remainingSeconds)<=WARNING_SECONDS).length;
  const rows = [
    { icon: Radar,  label: "Status",   value: active ? "Watching" : "Not set",                color: t.accent  },
    { icon: Bell,   label: "Heads-up", value: warnings ? `${warnings} due soon` : "All clear", color: warnings ? t.warn : t.accent },
    { icon: Shield, label: "Network",  value: "Arc Testnet",                                   color: t.accent2 },
  ];
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 590, justifySelf: "end", background: `linear-gradient(145deg, ${t.surface}, ${t.panel})`, border: `1px solid ${t.borderUp}`, borderRadius: 24, padding: isMobile ? 16 : 18, boxShadow: t.shadow, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 78% 0%, ${t.accent}24, transparent 34%), linear-gradient(135deg, transparent, ${t.accent}08)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.border}`, margin: "-2px -2px 18px", padding: "0 2px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.dangerLow, border: `1px solid ${t.danger}55` }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.warnLow,   border: `1px solid ${t.warn}55`   }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.accentLow, border: `1px solid ${t.accent}55` }} />
          </div>
          <div style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em" }}>DEADSWITCH OS</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 112px", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
          <div style={{ borderRadius: 18, background: t.bg, border: `1px solid ${t.border}`, padding: isMobile ? 16 : 18 }}>
            <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", margin: 0 }}>CURRENT PLAN</p>
            <h2 style={{ color: t.text, fontSize: isMobile ? 22 : 30, lineHeight: 1, margin: "10px 0 8px", letterSpacing: "-0.035em" }}>{nextSwitch ? nextSwitch.label : "No plan yet"}</h2>
            <p style={{ color: t.textSub, fontSize: 12, margin: 0, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextSwitch ? `USDC → ${truncateWallet(nextSwitch.destination)}` : "Create a backup plan to start watching"}
            </p>
          </div>
          <div style={{ borderRadius: 18, background: t.accentLow, border: `1px solid ${t.accent}30`, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: isMobile ? 110 : 0 }}>
            <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.12em", margin: 0 }}>NEXT REMINDER</p>
            <div>
              <p style={{ color: nextSwitch && Number(nextSwitch.remainingSeconds)<=WARNING_SECONDS ? t.danger : t.accent, fontSize: isMobile ? 34 : 40, lineHeight: 1, fontWeight: 900, margin: 0, fontFamily: "'DM Mono', monospace" }}>{nextSwitch ? nextSwitch.remaining : "--"}</p>
              <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.14em", margin: "5px 0 0" }}>{nextSwitch?.timer_unit === "minutes" ? "MIN" : "DAYS"}</p>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}><ProgressBar sw={nextSwitch} remaining={nextSwitch?.remaining||0} days={nextSwitch?.days||1} t={t} /></div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ padding: isMobile ? 12 : 14, borderRadius: 16, border: `1px solid ${t.border}`, background: t.panel }}>
              <row.icon size={16} color={row.color} />
              <p style={{ color: t.textMuted, fontSize: 11, margin: "10px 0 4px", fontWeight: 750 }}>{row.label}</p>
              <p style={{ color: t.text, fontSize: 15, margin: 0, fontWeight: 850 }}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SWITCH CARD ─────────────────────────────────────────────── */
function SwitchCard({ sw, onCheckin, onPause, onCancel, onAlert, onEdit, t }) {
  const meta = statusMeta(sw.status, t);
  const isFinal = sw.status === "cancelled" || sw.status === "triggered";
  const isOnChain = sw.contract_id !== null && sw.contract_id !== undefined;
  const isClose = Number(sw.remainingSeconds) <= WARNING_SECONDS && !isFinal;
  const timerColor = isClose ? t.danger : meta.color;
  return (
    <article style={{ background: `linear-gradient(180deg, ${t.surface}, ${t.panel})`, border: `1px solid ${isClose ? `${t.danger}70` : t.border}`, borderRadius: 18, padding: 18, boxShadow: isClose ? `0 18px 50px ${t.danger}18` : "0 12px 40px rgba(0,0,0,0.08)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <StatusPill status={sw.status} t={t} />
          <h3 style={{ color: t.text, fontSize: 17, lineHeight: 1.2, margin: "12px 0 4px", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sw.label}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: t.accentLow, color: t.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", border: `1px solid ${t.accent}30` }}>USDC</span>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>Arc Testnet</span>
            {sw.send_all ? (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>100% of balance</span>
            ) : sw.amount ? (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>{sw.amount} USDC</span>
            ) : null}
            {sw.contract_id !== null && sw.contract_id !== undefined && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.accentMid, color: t.accent, fontSize: 10, fontWeight: 900, border: `1px solid ${t.accent}40` }}>On-chain #{sw.contract_id}</span>
            )}
          </div>
          <p style={{ color: t.textSub, fontSize: 12, margin: 0, fontFamily: "'DM Mono', monospace" }}>→ {truncateWallet(sw.destination)}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ color: timerColor, fontSize: 28, lineHeight: 1, margin: 0, fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>{sw.remaining}</p>
          <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: "4px 0 0" }}>{sw.timer_unit === "minutes" ? "MIN LEFT" : "DAYS LEFT"}</p>
        </div>
      </div>
      <div style={{ margin: "16px 0" }}><ProgressBar sw={sw} remaining={sw.remaining} days={sw.days} t={t} /></div>
      <div style={{ minHeight: 48, padding: 13, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bg }}>
        <p style={{ color: t.textSub, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{sw.note ? `"${sw.note}"` : "No personal message added."}</p>
      </div>
      {sw.email && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: t.textMuted, fontSize: 11, marginTop: 12, fontFamily: "'DM Mono', monospace" }}>
          <Mail size={12} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sw.email}</span>
        </div>
      )}
      {!isFinal && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onCheckin(sw.id)} style={{ flex: 1, minHeight: 38, border: `1px solid ${t.accent}36`, background: t.accentLow, color: t.accent, borderRadius: 11, fontWeight: 850, fontSize: 12, letterSpacing: "0.04em", cursor: "pointer" }}>CHECK IN</button>
          {sw.email && <IconButton onClick={() => onAlert(sw)} title="Send warning email" t={t} tone="warn"><Mail size={15} /></IconButton>}
          <IconButton onClick={() => onEdit(sw)} title="Edit switch" t={t}><Pencil size={15} /></IconButton>
          {!isOnChain && <IconButton onClick={() => onPause(sw.id)} title={sw.status==="paused" ? "Resume" : "Pause"} t={t}>
            {sw.status==="paused" ? <Play size={15}/> : <Pause size={15}/>}
          </IconButton>}
          <IconButton onClick={() => onCancel(sw)} title="Cancel switch" t={t} tone="danger"><X size={15} /></IconButton>
        </div>
      )}
    </article>
  );
}

/* ── SWITCH MODAL ────────────────────────────────────────────── */
function SwitchModal({ onClose, onSubmit, initialSwitch, t, isConnected }) {
  const isOnChainEdit = initialSwitch?.contract_id !== null && initialSwitch?.contract_id !== undefined;
  const [form, setForm] = useState({
    label:       initialSwitch?.label       || "",
    days:        initialSwitch?.days        || 30,
    timer_unit:  initialSwitch?.timer_unit   || "days",
    destination: initialSwitch?.destination || "",
    send_all:    initialSwitch?.send_all    ?? true,
    amount:      initialSwitch?.amount      || "",
    email:       initialSwitch?.email       || "",
    note:        initialSwitch?.note        || "",
  });
  const [saving, setSaving] = useState(false);
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });

  const set  = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const ok   = form.label.trim() && form.destination.trim() && Number(form.days) > 0 && (form.send_all || form.amount);
  const inp  = { width: "100%", border: `1px solid ${t.border}`, background: t.bg, color: t.text, borderRadius: 12, padding: "12px 13px", outline: "none", fontSize: 14 };
  const lbl  = { color: t.textMuted, display: "block", fontSize: 11, letterSpacing: "0.12em", fontWeight: 850, margin: "16px 0 7px" };

  async function submit() {
    if (!ok || saving) return;
    setSaving(true); await onSubmit(form, balance); setSaving(false);
  }

  return (
    <div onClick={(e) => e.target===e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.70)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", borderRadius: 22, border: `1px solid ${t.borderUp}`, background: t.surface, boxShadow: t.shadow, padding: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "22px 22px 0 0", background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)` }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p style={{ color: t.accent, fontSize: 11, letterSpacing: "0.14em", fontWeight: 850, margin: 0 }}>{initialSwitch ? "EDIT PLAN" : "NEW BACKUP PLAN"}</p>
            <h2 style={{ color: t.text, fontSize: 22, margin: "8px 0 0", letterSpacing: "-0.02em" }}>{initialSwitch ? "Update your plan" : "Tell DeadSwitch what to do"}</h2>
          </div>
          <IconButton onClick={onClose} title="Close" t={t}><X size={15} /></IconButton>
        </div>

        {!isConnected && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.warnLow, border: `1px solid ${t.warn}40`, color: t.warn, fontSize: 12, fontWeight: 700 }}>
            ⚠️ Connect your wallet to deploy this switch on-chain
          </div>
        )}

        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.accentLow, border: `1px solid ${t.accent}30`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
          <span style={{ color: t.accent, fontSize: 12, fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>Arc Testnet · USDC</span>
        </div>

        {isOnChainEdit && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.warnLow, border: `1px solid ${t.warn}36`, color: t.warn, fontSize: 12, fontWeight: 750, lineHeight: 1.5 }}>
            This switch is already on-chain. You can edit the label, alert email, and note here. To change the wallet, amount, or timer, cancel it and create a new one.
          </div>
        )}

        <label style={lbl}>PLAN LABEL</label>
        <input style={inp} value={form.label} placeholder="e.g. Emergency recovery" onChange={(e) => set("label", e.target.value)} />

        <label style={lbl}>CHECK-IN TIMER</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {["days", "minutes"].map((unit) => (
            <button key={unit} disabled={isOnChainEdit} onClick={() => set("timer_unit", unit)} style={{ padding: "10px 0", borderRadius: 11, border: `1px solid ${form.timer_unit===unit ? t.accent : t.border}`, background: form.timer_unit===unit ? t.accentLow : t.bg, color: form.timer_unit===unit ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.55 : 1, fontWeight: 850, fontSize: 13, textTransform: "capitalize" }}>
              {unit}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
          {TIMER_PRESETS[form.timer_unit].map((d) => (
            <button key={d} disabled={isOnChainEdit} onClick={() => set("days", d)} style={{ padding: "10px 0", borderRadius: 11, border: `1px solid ${Number(form.days)===d ? t.accent : t.border}`, background: Number(form.days)===d ? t.accentLow : t.bg, color: Number(form.days)===d ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.55 : 1, fontWeight: 800, fontSize: 13 }}>
              {d}{form.timer_unit === "minutes" ? "m" : "d"}
            </button>
          ))}
        </div>
        <input disabled={isOnChainEdit} style={{ ...inp, marginTop: 8, opacity: isOnChainEdit ? 0.55 : 1, cursor: isOnChainEdit ? "not-allowed" : "text" }} type="number" min="1" max={form.timer_unit === "minutes" ? "10080" : "3650"} value={form.days} placeholder={`Custom ${form.timer_unit}`} onChange={(e) => set("days", e.target.value)} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 7px" }}>
          <span style={{ color: t.textMuted, fontSize: 11, letterSpacing: "0.12em", fontWeight: 850 }}>AMOUNT (USDC)</span>
          {balance && address ? (
            <span style={{ color: t.accent, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
              Balance: {parseFloat(balance.formatted).toFixed(2)} {balance.symbol}
            </span>
          ) : (
            <span style={{ color: t.textMuted, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Connect wallet to see balance</span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <button disabled={isOnChainEdit} onClick={() => set("send_all", true)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${form.send_all ? t.accent : t.border}`, background: form.send_all ? t.accentLow : t.bg, color: form.send_all ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.55 : 1, fontWeight: 800, fontSize: 13 }}>
            100% of balance
          </button>
          <button disabled={isOnChainEdit} onClick={() => set("send_all", false)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${!form.send_all ? t.accent : t.border}`, background: !form.send_all ? t.accentLow : t.bg, color: !form.send_all ? t.accent : t.textSub, cursor: isOnChainEdit ? "not-allowed" : "pointer", opacity: isOnChainEdit ? 0.55 : 1, fontWeight: 800, fontSize: 13 }}>
            Specific amount
          </button>
        </div>
        {!form.send_all && (
          <input disabled={isOnChainEdit} style={{ ...inp, opacity: isOnChainEdit ? 0.55 : 1, cursor: isOnChainEdit ? "not-allowed" : "text" }} type="number" min="0" step="any" value={form.amount} placeholder="Amount in USDC" onChange={(e) => set("amount", e.target.value)} />
        )}

        <label style={lbl}>BACKUP WALLET ADDRESS</label>
        <input disabled={isOnChainEdit} style={{ ...inp, fontFamily: "'DM Mono', monospace", opacity: isOnChainEdit ? 0.55 : 1, cursor: isOnChainEdit ? "not-allowed" : "text" }} value={form.destination} placeholder="0x..." onChange={(e) => set("destination", e.target.value)} />

        <label style={lbl}>ALERT EMAIL</label>
        <input style={inp} type="email" value={form.email} placeholder="you@example.com (warned when close)" onChange={(e) => set("email", e.target.value)} />

        <label style={lbl}>PERSONAL MESSAGE TO RECIPIENT</label>
        <textarea style={{ ...inp, minHeight: 96, lineHeight: 1.6, resize: "none" }} value={form.note} placeholder="A note for whoever receives this — optional." onChange={(e) => set("note", e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: 13, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: "pointer", fontWeight: 750 }}>Cancel</button>
          <button onClick={submit} style={{ padding: 13, borderRadius: 12, border: `1px solid ${ok ? t.accent : t.border}`, background: ok ? t.text : "transparent", color: ok ? t.bg : t.textMuted, cursor: ok ? "pointer" : "default", fontWeight: 850 }}>
            {saving ? "Deploying on-chain..." : initialSwitch ? "Save changes" : "Deploy backup plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── HOW IT WORKS MODAL ──────────────────────────────────────── */
function HowItWorksModal({ onClose, onCreateClick, t }) {
  const steps = [
    { step: "01", title: "Create a backup plan",      desc: "Set a destination wallet, pick a days or minutes check-in timer, and enter the USDC amount. Your switch deploys on Arc testnet." },
    { step: "02", title: "Check in regularly",         desc: "As long as you check in before your timer runs out, nothing happens. One tap resets the clock on-chain." },
    { step: "03", title: "Go silent — it activates",   desc: "If you stop checking in, Chainlink Automation triggers your contract and sends USDC to your backup address. No middleman." },
    { step: "04", title: "Get warned before it fires", desc: "Add your email and DeadSwitch will warn you when the deadline is close. You'll never be caught off guard." },
  ];
  return (
    <div onClick={(e) => e.target===e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", borderRadius: 22, border: `1px solid ${t.borderUp}`, background: t.surface, boxShadow: t.shadow, padding: 28, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "22px 22px 0 0", background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <p style={{ color: t.accent, fontSize: 11, letterSpacing: "0.14em", fontWeight: 850, margin: "0 0 8px" }}>DEADSWITCH</p>
            <h2 style={{ color: t.text, fontSize: 24, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>How it works</h2>
            <p style={{ color: t.textMuted, fontSize: 13, margin: "6px 0 0" }}>Four steps. Fully automatic.</p>
          </div>
          <IconButton onClick={onClose} title="Close" t={t}><X size={15} /></IconButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentLow, border: `1px solid ${t.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: t.accent, fontSize: 11, fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>{item.step}</span>
              </div>
              <div>
                <p style={{ color: t.text, fontSize: 15, fontWeight: 800, margin: "0 0 5px", letterSpacing: "-0.01em" }}>{item.title}</p>
                <p style={{ color: t.textSub, fontSize: 13, lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: t.border, margin: "24px 0" }} />
        <button onClick={() => { onClose(); onCreateClick(); }} style={{ width: "100%", padding: "13px 0", background: t.text, border: "none", borderRadius: 13, color: t.bg, fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: "-0.01em", transition: "opacity 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.opacity="0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity="1"}
        >
          Create my first backup plan →
        </button>
      </div>
    </div>
  );
}

/* ── MAIN APP ────────────────────────────────────────────────── */
export default function DeadSwitch() {
  const [dark, setDark]           = useState(false);
  const [session, setSession]     = useState(undefined);
  const [resetMode, setResetMode] = useState(false);
  const [switches, setSwitches]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHowIt, setShowHowIt] = useState(false);
  const [editingSwitch, setEditingSwitch] = useState(null);
  const [alertMsg, setAlertMsg]   = useState(null);
  const [now, setNow]             = useState(null);
  const [width, setWidth]         = useState(1024);
  const t = dark ? D : L;

  const { address, isConnected }  = useAccount();
  const { data: walletClient }    = useWalletClient();
  const publicClient              = usePublicClient();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const isRecovery = url.searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery" || url.searchParams.has("code");
    if (isRecovery) requestAnimationFrame(() => setResetMode(true));

    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) setSwitches([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSwitches() {
      if (!session) {
        requestAnimationFrame(() => {
          if (!ignore) setLoading(false);
        });
        return;
      }

      const { data, error } = await supabase
        .from("switches")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!ignore) {
        if (error) showToast(error.message);
        if (data) setSwitches(data);
        setLoading(false);
      }
    }

    loadSwitches();
    return () => { ignore = true; };
  }, [session]);

  useEffect(() => {
    const frame  = requestAnimationFrame(() => { setNow(new Date()); setWidth(window.innerWidth); });
    const tick   = setInterval(() => setNow(new Date()), 1000);
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); clearInterval(tick); window.removeEventListener("resize", resize); };
  }, []);

  const isMobile      = width < 700;
  const isTablet      = width < 980;
  const px            = isMobile ? 18 : width < 1180 ? 28 : 34;
  const heroTitleSize = isMobile ? "clamp(36px,10.5vw,52px)" : isTablet ? "clamp(48px,7vw,64px)" : "clamp(52px,4.7vw,68px)";
  const timedSwitches = useMemo(() => switches.map((sw) => withLiveTimer(sw, now || new Date())), [switches, now]);
  const activeSwitches = useMemo(() => timedSwitches.filter((s) => s.status !== "cancelled" && s.status !== "triggered"), [timedSwitches]);
  const historySwitches = useMemo(() => timedSwitches.filter((s) => s.status === "cancelled" || s.status === "triggered"), [timedSwitches]);
  const active        = activeSwitches.filter((s) => s.status !== "paused").length;
  const warnings      = activeSwitches.filter((s) => s.status === "warning" || Number(s.remainingSeconds) <= WARNING_SECONDS).length;
  const nextSwitch    = useMemo(() => activeSwitches.filter((s) => s.status !== "paused").slice().sort((a, b) => Number(a.remaining) - Number(b.remaining))[0], [activeSwitches]);

  function showToast(msg, timeout = 3600) { setAlertMsg(msg); setTimeout(() => setAlertMsg(null), timeout); }
  async function handleSignOut() { await supabase.auth.signOut(); showToast("Signed out"); }

  async function sendSwitchEmail(sw, type = "warning") {
    if (!sw.email) return { ok: true };
    const res  = await fetch("/api/send-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sw.email, label: sw.label, remaining: sw.remaining, type }) });
    const json = await res.json();
    return { ok: res.ok, json };
  }

  // ── Create switch: approve USDC → createSwitch on-chain → save to Supabase ──
  async function createSwitch(form, balance) {
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1");
    const timerUnit = form.timer_unit || "days";
    const timerSeconds = timerUnit === "minutes" ? days * 60 : days * 86400;
    if (!CONTRACT_ADDRESS) return showToast("Contract address is missing. Check your environment variables.");
    if (!isConnected || !walletClient || !publicClient) return showToast("Connect your wallet before creating a backup plan");

    let contract_id = null;
    let tx_hash = null;

    try {
      // Work out USDC amount — 6 decimals on Arc ERC-20 interface
      let usdcAmount;
      if (form.send_all && balance) {
        usdcAmount = parseUnits(parseFloat(balance.formatted).toFixed(6), 6);
      } else if (form.amount) {
        usdcAmount = parseUnits(String(Number(form.amount).toFixed(6)), 6);
      } else {
        return showToast("Please enter a USDC amount");
      }

      if (usdcAmount <= 0n) return showToast("USDC amount must be greater than zero");

      // Step 1 — Approve USDC
      showToast("Step 1/2 — Approve USDC... confirm in wallet");
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, usdcAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      showToast("Approved ✅ Step 2/2 — Deploying switch...");

      // Step 2 — Create switch on-chain
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "createSwitch",
        args: [form.destination, usdcAmount, BigInt(timerSeconds)],
      });

      showToast("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      tx_hash = hash;

      const switchCreatedLogs = parseEventLogs({
        abi: CONTRACT_ABI,
        logs: receipt.logs,
        eventName: "SwitchCreated",
      });
      const switchId = switchCreatedLogs[0]?.args?.id;
      if (switchId === undefined) throw new Error("SwitchCreated event was not found in the transaction receipt");
      contract_id = switchId.toString();

      showToast("On-chain deployment confirmed! ✅");
    } catch (err) {
      console.error("Contract error:", err);
      return showToast("On-chain deploy failed — backup plan was not saved", 5200);
    }

    const { data, error } = await supabase.from("switches").insert([{
      label: form.label, days, remaining: days, timer_unit: timerUnit,
      destination: form.destination,
      chain: "Arc Testnet", token: "USDC",
      send_all: form.send_all,
      amount: form.send_all ? null : form.amount,
      note: form.note, email: form.email || null,
      status: "active", user_id: session.user.id,
      contract_id, tx_hash,
    }]).select().single();

    if (error) return showToast(error.message || "Failed to create switch");
    setSwitches((p) => [data, ...p]);
    setShowModal(false);
    showToast(contract_id !== null ? `Deployed on-chain! Switch #${contract_id}` : "Backup plan created");
    if (data.email) sendSwitchEmail(data, "created");
  }

  async function updateSwitch(form) {
    if (!editingSwitch) return;
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1");

    const isOnChain = editingSwitch.contract_id !== null && editingSwitch.contract_id !== undefined;
    const updatePayload = isOnChain ? {
      label: form.label,
      note: form.note,
      email: form.email || null,
    } : {
      label: form.label, days, remaining: days, timer_unit: form.timer_unit || "days",
      destination: form.destination,
      chain: "Arc Testnet", token: "USDC",
      send_all: form.send_all,
      amount: form.send_all ? null : form.amount,
      note: form.note, email: form.email || null,
      status: editingSwitch.status === "triggered" ? "active" : editingSwitch.status,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("switches").update(updatePayload).eq("id", editingSwitch.id).select().single();
    if (error) return showToast(error.message || "Failed to update switch");
    setSwitches((p) => p.map((sw) => sw.id === editingSwitch.id ? data : sw));
    setEditingSwitch(null); setShowModal(false);
    showToast(isOnChain ? "Plan details updated" : "Backup plan updated");
  }

  // ── Check in: on-chain + Supabase ──
  async function checkIn(id) {
    const sw = switches.find((s) => s.id === id);
    if (!sw) return;

    if (sw.contract_id !== null && sw.contract_id !== undefined) {
      if (!isConnected || !walletClient || !publicClient) return showToast("Connect the wallet that created this switch to check in on-chain");
      try {
        showToast("Checking in on-chain... confirm in wallet");
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "checkIn",
          args: [BigInt(sw.contract_id), BigInt(durationSeconds(sw))],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        showToast("On-chain check-in confirmed ✅");
      } catch (err) {
        console.error("Check-in error:", err);
        return showToast("On-chain check-in failed — nothing was changed", 5200);
      }
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
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "cancel",
          args: [BigInt(sw.contract_id)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        showToast("USDC returned to your wallet ✅");
      } catch (err) {
        console.error("Cancel error:", err);
        return showToast("On-chain cancel failed — plan was not cancelled");
      }
    }

    const { data, error } = await supabase
      .from("switches")
      .update({ status: "cancelled" })
      .eq("id", sw.id)
      .select()
      .single();
    if (error) return showToast(error.message || "Failed to cancel plan");
    setSwitches((p) => p.map((s) => s.id === sw.id ? data : s));
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
    switches.forEach((sw) => {
      if (!sw.email || sw.status !== "active" || Number(sw.remainingSeconds) > WARNING_SECONDS) return;
      const key = `deadswitch-warning-${sw.id}-${sw.remaining}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "sent");
      sendSwitchEmail(sw, "warning");
    });
  }, [switches]);

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(140deg, ${t.bg}, ${t.bg2})`, display: "grid", placeItems: "center" }}>
      <style>{`* { box-sizing:border-box; } body { margin:0; }`}</style>
      <p style={{ color: t.textMuted, fontFamily: "sans-serif", fontSize: 14 }}>Loading...</p>
    </div>
  );

  if (!session || resetMode) return <AuthScreen t={t} initialMode={resetMode ? "reset" : "signin"} onPasswordResetComplete={() => setResetMode(false)} />;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(140deg, ${t.bg}, ${t.bg2})`, color: t.text, transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,650;0,9..40,800;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; } body { margin:0; }
        button, input, select, textarea { font-family:'DM Sans',sans-serif; }
        button { min-width:0; } input, select, textarea { max-width:100%; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.84)} }
      `}</style>

      {alertMsg && (
        <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 300, display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderRadius: 14, background: t.surface, color: t.text, border: `1px solid ${t.borderUp}`, boxShadow: t.shadow, fontSize: 13, fontWeight: 750 }}>
          <Bell size={15} color={t.accent} />{alertMsg}
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: `0 ${px}px`, borderBottom: `1px solid ${t.border}`, backdropFilter: "blur(22px)", background: dark ? "rgba(7,8,13,0.82)" : "rgba(246,247,244,0.82)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <DSLogo t={t} size={42} />
            <div>
              <p style={{ color: t.text, fontWeight: 900, margin: 0, fontSize: 16, letterSpacing: "-0.01em" }}>DeadSwitch</p>
              {!isMobile && <p style={{ color: t.textMuted, margin: "2px 0 0", fontSize: 10, letterSpacing: "0.06em", fontFamily: "'DM Mono',monospace" }}>{session.user.email}</p>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                <Clock size={12} />{now ? now.toLocaleTimeString() : "--:--:--"}
              </div>
            )}
            <div style={{ "--rk-radii-connectButton": "12px" }}>
              <ConnectButton showBalance={false} chainStatus={isMobile ? "none" : "icon"} accountStatus={isMobile ? "avatar" : "full"} />
            </div>
            <button onClick={() => setDark((v) => !v)} style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 13, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, cursor: "pointer" }}>
              {dark ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <IconButton onClick={handleSignOut} title="Sign out" t={t} tone="danger"><LogOut size={15} /></IconButton>
          </div>
        </div>
      </nav>

      {isConnected && address && (
        <div style={{ background: t.accentLow, borderBottom: `1px solid ${t.accent}25`, padding: `10px ${px}px` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, color: t.accent, fontSize: 12, fontWeight: 750, fontFamily: "'DM Mono',monospace" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, display: "inline-block", animation: "pulseDot 1.8s ease infinite" }} />
            Wallet connected: {truncateWallet(address)} · Arc Testnet
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: `${isMobile ? 30 : 50}px ${px}px 90px` }}>
        <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,0.95fr) minmax(460px,590px)", gap: isTablet ? 28 : 52, alignItems: "start", animation: "fadeUp .45s ease" }}>
          <div style={{ maxWidth: isTablet ? 760 : 590, paddingTop: isTablet ? 0 : 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 11, fontWeight: 850, letterSpacing: "0.10em", marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, animation: "pulseDot 1.8s ease infinite" }} />
              CRYPTO BACKUP AGENT · ARC TESTNET
            </div>
            <h1 style={{ color: t.text, fontSize: heroTitleSize, lineHeight: isMobile ? 1.04 : 1, letterSpacing: "-0.048em", margin: "0 0 20px", fontWeight: 900, maxWidth: 620 }}>
              Life happens. Your crypto should know what to do.
            </h1>
            <p style={{ color: t.textSub, fontSize: isMobile ? 15 : 17, lineHeight: 1.68, maxWidth: 510, margin: "0 0 26px" }}>
              Choose a backup wallet, set a check-in timer, and get reminded before your plan kicks in.
            </p>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginBottom: 30, maxWidth: isMobile ? "100%" : 520 }}>
              <button onClick={() => { setEditingSwitch(null); setShowModal(true); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 20px", borderRadius: 14, border: "none", background: t.text, color: t.bg, fontWeight: 900, cursor: "pointer", boxShadow: t.shadow, width: isMobile ? "100%" : "auto" }}>
                <Plus size={17}/>Create my backup plan
              </button>
              <button onClick={() => setShowHowIt(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontWeight: 800, cursor: "pointer", width: isMobile ? "100%" : "auto", transition: "border-color 0.2s, color 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textSub; }}
              >
                <LockKeyhole size={16}/>How it works<ChevronRight size={15}/>
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(3,minmax(0,150px))", gap: 12, maxWidth: 500 }}>
              {[["Plans", active], ["Due soon", warnings], ["Network", "Arc"]].map(([label, value]) => (
                <div key={label} style={{ padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.panel }}>
                  <p style={{ color: t.text, fontSize: isMobile ? 23 : 28, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>{value}</p>
                  <p style={{ color: t.textMuted, fontSize: isMobile ? 9 : 10, fontWeight: 850, letterSpacing: isMobile ? "0.06em" : "0.12em", margin: "5px 0 0", whiteSpace: "nowrap" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", justifyContent: isTablet ? "flex-start" : "flex-end", alignSelf: "start", paddingTop: isTablet ? 0 : 4 }}>
            <AgentConsole switches={activeSwitches} nextSwitch={nextSwitch} t={t} isMobile={isMobile} />
          </div>
        </section>

        <section style={{ marginTop: isMobile ? 42 : 66 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 20 }}>
            <div>
              <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", margin: "0 0 8px" }}>YOUR PLANS</p>
              <h2 style={{ color: t.text, fontSize: isMobile ? 24 : 32, margin: 0, letterSpacing: "-0.035em" }}>Your backup plans</h2>
            </div>
            <button onClick={() => { setEditingSwitch(null); setShowModal(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px", borderRadius: 13, border: `1px solid ${t.accent}30`, background: t.accentLow, color: t.accent, cursor: "pointer", fontWeight: 850 }}>
              <Plus size={15}/>New
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 50, textAlign: "center", color: t.textSub }}>Loading switches...</div>
          ) : activeSwitches.length ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 14 }}>
              {activeSwitches.map((sw) => (
                <SwitchCard key={sw.id} sw={sw} onCheckin={checkIn} onPause={pauseSwitch} onCancel={cancelSwitch} onAlert={sendAlert} onEdit={(item) => { setEditingSwitch(item); setShowModal(true); }} t={t} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "72px 20px", borderRadius: 22, border: `1px solid ${t.border}`, background: t.panel }}>
              <Shield size={42} color={t.textMuted} />
              <h3 style={{ color: t.text, margin: "18px 0 7px", fontSize: 22 }}>No backup plans yet</h3>
              <p style={{ color: t.textSub, margin: "0 0 22px" }}>Create your first backup plan and let DeadSwitch start watching.</p>
              <button onClick={() => { setEditingSwitch(null); setShowModal(true); }} style={{ padding: "12px 18px", borderRadius: 13, border: `1px solid ${t.accent}35`, background: t.accentLow, color: t.accent, cursor: "pointer", fontWeight: 850 }}>
                Create backup plan
              </button>
            </div>
          )}
        </section>

        <section style={{ marginTop: isMobile ? 34 : 46 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 20 }}>
            <div>
              <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", margin: "0 0 8px" }}>HISTORY</p>
              <h2 style={{ color: t.text, fontSize: isMobile ? 22 : 28, margin: 0, letterSpacing: "-0.035em" }}>Executed and cancelled</h2>
            </div>
            <span style={{ color: t.textMuted, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{historySwitches.length} archived</span>
          </div>
          {historySwitches.length ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 14 }}>
              {historySwitches.map((sw) => (
                <SwitchCard key={sw.id} sw={sw} onCheckin={checkIn} onPause={pauseSwitch} onCancel={cancelSwitch} onAlert={sendAlert} onEdit={(item) => { setEditingSwitch(item); setShowModal(true); }} t={t} />
              ))}
            </div>
          ) : (
            <div style={{ padding: "28px 20px", borderRadius: 18, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 13 }}>
              No executed or cancelled switches yet.
            </div>
          )}
        </section>
      </main>

      <footer style={{ padding: `20px ${px}px`, borderTop: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: t.textMuted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
          <span>DEADSWITCH</span>
          <span>Built on Arc Testnet · USDC · Circle infrastructure</span>
        </div>
      </footer>

      {showModal  && <SwitchModal onClose={() => { setShowModal(false); setEditingSwitch(null); }} onSubmit={editingSwitch ? updateSwitch : createSwitch} initialSwitch={editingSwitch} t={t} isConnected={isConnected} />}
      {showHowIt  && <HowItWorksModal onClose={() => setShowHowIt(false)} onCreateClick={() => { setEditingSwitch(null); setShowModal(true); }} t={t} />}
    </div>
  );
}
