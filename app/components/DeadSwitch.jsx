"use client";

import { supabase } from "../supabase";
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  Layers,
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

// Chain → supported tokens mapping
const CHAIN_TOKENS = {
  Ethereum:  ["ETH", "USDC", "USDT"],
  Base:      ["ETH", "USDC", "USDT"],
  Kite:      ["KITE", "USDC"],
  Polygon:   ["MATIC", "USDC", "USDT"],
  Arbitrum:  ["ETH", "USDC", "USDT"],
  Optimism:  ["ETH", "USDC", "USDT"],
};

const CHAINS = Object.keys(CHAIN_TOKENS);
const TIMER_PRESETS = [2, 5, 30, 60, 90, 180];

function truncateWallet(value = "") {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 3.8L43.5 24L24 44.2L4.5 24L24 3.8Z" fill={t.bg} stroke={t.borderUp} strokeWidth="1.6" />
        <path d="M16.5 15.8H25.7C30.3 15.8 33.9 19.4 33.9 24C33.9 28.6 30.3 32.2 25.7 32.2H16.5V15.8Z" stroke={t.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 24H29.2" stroke={t.accent} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M27.4 20.3L31.2 24L27.4 27.7" stroke={t.accent} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.8 11.6L36.2 36.4" stroke={t.accent} strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
      </svg>
      <span style={{ position: "absolute", inset: -4, borderRadius: 18, boxShadow: `0 0 34px ${t.accent}24`, pointerEvents: "none" }} />
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}24`, fontSize: 11, fontWeight: 800, letterSpacing: "0.02em" }}>
      <meta.Icon size={12} strokeWidth={2.4} />
      {meta.label}
    </span>
  );
}

function ProgressBar({ remaining, days, t }) {
  const percent = Math.max(0, Math.min(100, (Number(remaining) / Number(days || 1)) * 100));
  const color = percent <= 15 ? t.danger : percent <= 35 ? t.warn : t.accent;
  return (
    <div style={{ height: 7, borderRadius: 999, background: t.surfaceUp, overflow: "hidden", border: `1px solid ${t.border}` }}>
      <div style={{ width: `${percent}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${t.accent2})`, boxShadow: `0 0 18px ${color}55` }} />
    </div>
  );
}

// ── AUTH SCREEN ──────────────────────────────────────────────────
function AuthScreen({ t }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const input = { width: "100%", border: `1px solid ${t.border}`, background: t.bg, color: t.text, borderRadius: 12, padding: "12px 14px", outline: "none", fontSize: 14, boxSizing: "border-box" };

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
    else setMessage("Check your email to confirm your account, then sign in.");
    setLoading(false);
  }

  async function handleMagicLink() {
    if (!email) return setError("Please enter your email");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setError(error.message);
    else setMessage("Magic link sent! Check your email and click the link to sign in.");
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 24, background: t.bg, borderRadius: 12, padding: 4 }}>
            {[["signin", "Sign In"], ["signup", "Sign Up"], ["magic", "Magic Link"]].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }} style={{ padding: "8px 0", borderRadius: 9, border: "none", background: mode === m ? t.surface : "transparent", color: mode === m ? t.text : t.textMuted, fontWeight: mode === m ? 800 : 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s", boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.12)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>EMAIL</label>
              <input style={input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "magic" && (
              <div>
                <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>PASSWORD</label>
                <input style={input} type="password" placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? handleSignIn() : handleSignUp())} />
              </div>
            )}
          </div>
          {error && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.dangerLow, border: `1px solid ${t.danger}30`, color: t.danger, fontSize: 13 }}>{error}</div>}
          {message && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: t.accentLow, border: `1px solid ${t.accent}30`, color: t.accent, fontSize: 13 }}>{message}</div>}
          <button onClick={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleMagicLink} style={{ width: "100%", marginTop: 20, padding: "13px 0", background: t.text, border: "none", borderRadius: 13, color: t.bg, fontSize: 14, fontWeight: 900, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s", letterSpacing: "-0.01em" }}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send magic link →"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>
          <p style={{ color: t.textMuted, fontSize: 13, textAlign: "center", margin: 0 }}>
            {mode === "signin" ? <>No account? <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign up</button></> :
             mode === "signup" ? <>Already have an account? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></> :
             <>Remember your password? <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: t.accent, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button></>}
          </p>
        </div>
        <p style={{ color: t.textMuted, fontSize: 11, textAlign: "center", marginTop: 20, fontFamily: "'DM Mono', monospace" }}>DEADSWITCH · Built for recovery and peace of mind</p>
      </div>
    </div>
  );
}

function AgentConsole({ switches, nextSwitch, t, isMobile }) {
  const active = switches.filter((s) => s.status === "active" || s.status === "warning").length;
  const warnings = switches.filter((s) => s.status === "warning" || Number(s.remaining) <= 7).length;
  const chains = [...new Set(switches.map((s) => s.chain))].length;
  const rows = [
    { icon: Radar, label: "Status", value: active ? "Watching" : "Not set", color: t.accent },
    { icon: Bell, label: "Heads-up", value: warnings ? `${warnings} due soon` : "All clear", color: warnings ? t.warn : t.accent },
    { icon: Layers, label: "Chains", value: `${chains || 0} covered`, color: t.accent2 },
  ];
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 590, justifySelf: "end", background: `linear-gradient(145deg, ${t.surface}, ${t.panel})`, border: `1px solid ${t.borderUp}`, borderRadius: 24, padding: isMobile ? 16 : 18, boxShadow: t.shadow, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 78% 0%, ${t.accent}24, transparent 34%), linear-gradient(135deg, transparent, ${t.accent}08)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.border}`, margin: "-2px -2px 18px", padding: "0 2px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.dangerLow, border: `1px solid ${t.danger}55` }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.warnLow, border: `1px solid ${t.warn}55` }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.accentLow, border: `1px solid ${t.accent}55` }} />
          </div>
          <div style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em" }}>DEADSWITCH OS</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 112px", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
          <div style={{ borderRadius: 18, background: t.bg, border: `1px solid ${t.border}`, padding: isMobile ? 16 : 18 }}>
            <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.12em", margin: 0 }}>CURRENT PLAN</p>
            <h2 style={{ color: t.text, fontSize: isMobile ? 22 : 30, lineHeight: 1, margin: "10px 0 8px", letterSpacing: "-0.035em" }}>{nextSwitch ? nextSwitch.label : "No plan yet"}</h2>
            <p style={{ color: t.textSub, fontSize: 12, margin: 0, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextSwitch ? `${nextSwitch.chain} · ${nextSwitch.token || "—"} → ${truncateWallet(nextSwitch.destination)}` : "Create a backup plan to start watching"}
            </p>
          </div>
          <div style={{ borderRadius: 18, background: t.accentLow, border: `1px solid ${t.accent}30`, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: isMobile ? 110 : 0 }}>
            <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.12em", margin: 0 }}>NEXT REMINDER</p>
            <div>
              <p style={{ color: t.accent, fontSize: isMobile ? 34 : 40, lineHeight: 1, fontWeight: 900, margin: 0, fontFamily: "'DM Mono', monospace" }}>{nextSwitch ? nextSwitch.remaining : "--"}</p>
              <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.14em", margin: "5px 0 0" }}>DAYS</p>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}><ProgressBar remaining={nextSwitch?.remaining || 0} days={nextSwitch?.days || 1} t={t} /></div>
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

function SwitchCard({ sw, onCheckin, onPause, onCancel, onAlert, onEdit, t }) {
  const meta = statusMeta(sw.status, t);
  return (
    <article style={{ background: `linear-gradient(180deg, ${t.surface}, ${t.panel})`, border: `1px solid ${Number(sw.remaining) <= 7 ? `${t.warn}45` : t.border}`, borderRadius: 18, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.08)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <StatusPill status={sw.status} t={t} />
          <h3 style={{ color: t.text, fontSize: 17, lineHeight: 1.2, margin: "12px 0 4px", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sw.label}</h3>
          {/* Token + chain badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {sw.token && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.accentLow, color: t.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", border: `1px solid ${t.accent}30` }}>
                {sw.token}
              </span>
            )}
            {sw.send_all && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", border: `1px solid ${t.border}` }}>
                100% of balance
              </span>
            )}
            {!sw.send_all && sw.amount && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: t.surfaceUp, color: t.textSub, fontSize: 10, fontWeight: 800, border: `1px solid ${t.border}` }}>
                {sw.amount} {sw.token}
              </span>
            )}
          </div>
          <p style={{ color: t.textSub, fontSize: 12, margin: 0, fontFamily: "'DM Mono', monospace" }}>{`${sw.chain} → ${truncateWallet(sw.destination)}`}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ color: meta.color, fontSize: 28, lineHeight: 1, margin: 0, fontWeight: 900, fontFamily: "'DM Mono', monospace" }}>{sw.remaining}</p>
          <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", margin: "4px 0 0" }}>DAYS</p>
        </div>
      </div>
      <div style={{ margin: "16px 0" }}><ProgressBar remaining={sw.remaining} days={sw.days} t={t} /></div>
      <div style={{ minHeight: 48, padding: 13, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bg }}>
        <p style={{ color: t.textSub, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{sw.note ? `"${sw.note}"` : "No personal message added."}</p>
      </div>
      {sw.email && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: t.textMuted, fontSize: 11, marginTop: 12, fontFamily: "'DM Mono', monospace" }}>
          <Mail size={12} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sw.email}</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: sw.email ? "1fr 38px 38px 38px 38px" : "1fr 38px 38px 38px", gap: 8, marginTop: 16 }}>
        <button onClick={() => onCheckin(sw.id)} style={{ border: `1px solid ${t.accent}36`, background: t.accentLow, color: t.accent, borderRadius: 11, fontWeight: 850, fontSize: 12, letterSpacing: "0.04em", cursor: "pointer" }}>CHECK IN</button>
        {sw.email && <IconButton onClick={() => onAlert(sw)} title="Send warning email" t={t} tone="warn"><Mail size={15} /></IconButton>}
        <IconButton onClick={() => onEdit(sw)} title="Edit switch" t={t}><Pencil size={15} /></IconButton>
        <IconButton onClick={() => onPause(sw.id)} title={sw.status === "paused" ? "Resume" : "Pause"} t={t}>
          {sw.status === "paused" ? <Play size={15} /> : <Pause size={15} />}
        </IconButton>
        <IconButton onClick={() => onCancel(sw)} title="Cancel switch" t={t} tone="danger"><X size={15} /></IconButton>
      </div>
    </article>
  );
}

// ── SWITCH MODAL (restructured with token selector) ───────────────
function SwitchModal({ onClose, onSubmit, initialSwitch, t }) {
  const [form, setForm] = useState({
    label:       initialSwitch?.label       || "",
    days:        initialSwitch?.days        || 30,
    destination: initialSwitch?.destination || "",
    chain:       initialSwitch?.chain       || "Ethereum",
    token:       initialSwitch?.token       || "ETH",
    send_all:    initialSwitch?.send_all    ?? true,
    amount:      initialSwitch?.amount      || "",
    email:       initialSwitch?.email       || "",
    note:        initialSwitch?.note        || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // When chain changes, reset token to first available
  function handleChainChange(chain) {
    const tokens = CHAIN_TOKENS[chain];
    setForm((prev) => ({ ...prev, chain, token: tokens[0] }));
  }

  const availableTokens = CHAIN_TOKENS[form.chain] || [];
  const ok = form.label.trim() && form.destination.trim() && Number(form.days) > 0 && (form.send_all || form.amount);

  const input = { width: "100%", border: `1px solid ${t.border}`, background: t.bg, color: t.text, borderRadius: 12, padding: "12px 13px", outline: "none", fontSize: 14 };
  const labelStyle = { color: t.textMuted, display: "block", fontSize: 11, letterSpacing: "0.12em", fontWeight: 850, margin: "16px 0 7px" };

  async function submit() {
    if (!ok || saving) return;
    setSaving(true); await onSubmit(form); setSaving(false);
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.70)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", borderRadius: 22, border: `1px solid ${t.borderUp}`, background: t.surface, boxShadow: t.shadow, padding: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "22px 22px 0 0", background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)` }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p style={{ color: t.accent, fontSize: 11, letterSpacing: "0.14em", fontWeight: 850, margin: 0 }}>{initialSwitch ? "EDIT PLAN" : "NEW BACKUP PLAN"}</p>
            <h2 style={{ color: t.text, fontSize: 22, margin: "8px 0 0", letterSpacing: "-0.02em" }}>{initialSwitch ? "Update your plan" : "Tell DeadSwitch what to do"}</h2>
          </div>
          <IconButton onClick={onClose} title="Close" t={t}><X size={15} /></IconButton>
        </div>

        {/* Label */}
        <label style={labelStyle}>PLAN LABEL</label>
        <input style={input} value={form.label} placeholder="e.g. Emergency recovery" onChange={(e) => set("label", e.target.value)} />

        {/* Timer */}
        <label style={labelStyle}>CHECK-IN TIMER</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
          {TIMER_PRESETS.map((days) => (
            <button key={days} onClick={() => set("days", days)} style={{ padding: "10px 0", borderRadius: 11, border: `1px solid ${Number(form.days) === days ? t.accent : t.border}`, background: Number(form.days) === days ? t.accentLow : t.bg, color: Number(form.days) === days ? t.accent : t.textSub, cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
              {days}d
            </button>
          ))}
        </div>
        <input style={{ ...input, marginTop: 8 }} type="number" min="1" max="3650" value={form.days} placeholder="Custom days" onChange={(e) => set("days", e.target.value)} />

        {/* Chain */}
        <label style={labelStyle}>CHAIN</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
          {CHAINS.map((chain) => (
            <button key={chain} onClick={() => handleChainChange(chain)} style={{ padding: "10px 0", borderRadius: 11, border: `1px solid ${form.chain === chain ? t.accent : t.border}`, background: form.chain === chain ? t.accentLow : t.bg, color: form.chain === chain ? t.accent : t.textSub, cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
              {chain}
            </button>
          ))}
        </div>

        {/* Token — auto-updates based on chain */}
        <label style={labelStyle}>ASSET TO SEND</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableTokens.map((token) => (
            <button key={token} onClick={() => set("token", token)} style={{ padding: "10px 18px", borderRadius: 11, border: `1px solid ${form.token === token ? t.accent : t.border}`, background: form.token === token ? t.accentLow : t.bg, color: form.token === token ? t.accent : t.textSub, cursor: "pointer", fontWeight: 800, fontSize: 13, letterSpacing: "0.04em" }}>
              {token}
            </button>
          ))}
        </div>

        {/* Amount — send all toggle */}
        <label style={labelStyle}>AMOUNT</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <button onClick={() => set("send_all", true)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${form.send_all ? t.accent : t.border}`, background: form.send_all ? t.accentLow : t.bg, color: form.send_all ? t.accent : t.textSub, cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
            100% of balance
          </button>
          <button onClick={() => set("send_all", false)} style={{ padding: "11px 0", borderRadius: 11, border: `1px solid ${!form.send_all ? t.accent : t.border}`, background: !form.send_all ? t.accentLow : t.bg, color: !form.send_all ? t.accent : t.textSub, cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
            Specific amount
          </button>
        </div>
        {!form.send_all && (
          <input style={input} type="number" min="0" step="any" value={form.amount} placeholder={`Amount in ${form.token}`} onChange={(e) => set("amount", e.target.value)} />
        )}

        {/* Destination wallet */}
        <label style={labelStyle}>BACKUP WALLET ADDRESS</label>
        <input style={{ ...input, fontFamily: "'DM Mono', monospace" }} value={form.destination} placeholder="0x..." onChange={(e) => set("destination", e.target.value)} />

        {/* Alert email */}
        <label style={labelStyle}>ALERT EMAIL</label>
        <input style={input} type="email" value={form.email} placeholder="you@example.com (get warned 7 days before)" onChange={(e) => set("email", e.target.value)} />

        {/* Personal message */}
        <label style={labelStyle}>PERSONAL MESSAGE TO RECIPIENT</label>
        <textarea style={{ ...input, minHeight: 80, lineHeight: 1.6, resize: "vertical" }} value={form.note} placeholder="A note for whoever receives this — optional." onChange={(e) => set("note", e.target.value)} />

        {/* Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: 13, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: "pointer", fontWeight: 750 }}>Cancel</button>
          <button onClick={submit} style={{ padding: 13, borderRadius: 12, border: `1px solid ${ok ? t.accent : t.border}`, background: ok ? t.text : "transparent", color: ok ? t.bg : t.textMuted, cursor: ok ? "pointer" : "default", fontWeight: 850 }}>
            {saving ? "Saving..." : initialSwitch ? "Save changes" : "Save backup plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HowItWorksModal({ onClose, onCreateClick, t }) {
  const steps = [
    { step: "01", title: "Create a backup plan", desc: "Choose a chain, pick your asset, set a destination wallet and a check-in timer. That's your switch." },
    { step: "02", title: "Check in regularly", desc: "As long as you check in before your timer runs out, nothing happens. One tap resets the clock." },
    { step: "03", title: "Go silent — it activates", desc: "If you stop checking in, DeadSwitch moves your assets to the address you set. No middleman." },
    { step: "04", title: "Get warned before it fires", desc: "Add your email and DeadSwitch will warn you at 7 days remaining. You'll never be caught off guard." },
  ];
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 16 }}>
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
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          Create my first backup plan →
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────
export default function DeadSwitch() {
  const [dark, setDark] = useState(false);
  const [session, setSession] = useState(undefined);
  const [switches, setSwitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHowIt, setShowHowIt] = useState(false);
  const [editingSwitch, setEditingSwitch] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const [now, setNow] = useState(null);
  const [width, setWidth] = useState(1024);
  const t = dark ? D : L;
  const { address, isConnected } = useAccount();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setSwitches([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    async function loadSwitches() {
      const { data, error } = await supabase.from("switches").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (error) showToast(error.message);
      if (data) setSwitches(data);
      setLoading(false);
    }
    loadSwitches();
  }, [session]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setNow(new Date()); setWidth(window.innerWidth); });
    const tick = setInterval(() => setNow(new Date()), 1000);
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); clearInterval(tick); window.removeEventListener("resize", resize); };
  }, []);

  const isMobile = width < 700;
  const isTablet = width < 980;
  const px = isMobile ? 18 : width < 1180 ? 28 : 34;
  const heroTitleSize = isMobile ? "clamp(36px, 10.5vw, 52px)" : isTablet ? "clamp(48px, 7vw, 64px)" : "clamp(52px, 4.7vw, 68px)";
  const active = switches.filter((s) => s.status !== "paused").length;
  const warnings = switches.filter((s) => s.status === "warning" || Number(s.remaining) <= 7).length;
  const chains = [...new Set(switches.map((s) => s.chain))].length;
  const nextSwitch = useMemo(() => switches.filter((s) => s.status !== "paused").slice().sort((a, b) => Number(a.remaining) - Number(b.remaining))[0], [switches]);

  function showToast(message, timeout = 3600) {
    setAlertMsg(message);
    setTimeout(() => setAlertMsg(null), timeout);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    showToast("Signed out");
  }

  async function sendSwitchEmail(sw, type = "warning") {
    if (!sw.email) return { ok: true };
    const res = await fetch("/api/send-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sw.email, label: sw.label, remaining: sw.remaining, type }) });
    const json = await res.json();
    return { ok: res.ok, json };
  }

  async function createSwitch(form) {
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1 day");
    const { data, error } = await supabase.from("switches").insert([{
      label: form.label, days, remaining: days,
      destination: form.destination, chain: form.chain,
      token: form.token, send_all: form.send_all,
      amount: form.send_all ? null : form.amount,
      note: form.note, email: form.email || null,
      status: "active", user_id: session.user.id,
    }]).select().single();
    if (error) return showToast(error.message || "Failed to create switch");
    setSwitches((prev) => [data, ...prev]);
    setShowModal(false);
    showToast("Backup plan created");
    if (data.email) sendSwitchEmail(data, "created");
  }

  async function updateSwitch(form) {
    if (!editingSwitch) return;
    const days = Number(form.days);
    if (!days || days < 1) return showToast("Timer must be at least 1 day");
    const { data, error } = await supabase.from("switches").update({
      label: form.label, days, remaining: days,
      destination: form.destination, chain: form.chain,
      token: form.token, send_all: form.send_all,
      amount: form.send_all ? null : form.amount,
      note: form.note, email: form.email || null,
      status: editingSwitch.status === "triggered" ? "active" : editingSwitch.status,
    }).eq("id", editingSwitch.id).select().single();
    if (error) return showToast(error.message || "Failed to update switch");
    setSwitches((prev) => prev.map((sw) => (sw.id === editingSwitch.id ? data : sw)));
    setEditingSwitch(null); setShowModal(false);
    showToast("Backup plan updated");
  }

  async function checkIn(id) {
    const sw = switches.find((item) => item.id === id);
    if (!sw) return;
    const { data, error } = await supabase.from("switches").update({ remaining: sw.days, status: "active" }).eq("id", id).select().single();
    if (error) return showToast(error.message || "Check-in failed");
    setSwitches((prev) => prev.map((item) => (item.id === id ? data : item)));
    showToast("Check-in confirmed");
  }

  async function pauseSwitch(id) {
    const sw = switches.find((item) => item.id === id);
    if (!sw) return;
    const status = sw.status === "paused" ? "active" : "paused";
    const { data, error } = await supabase.from("switches").update({ status }).eq("id", id).select().single();
    if (error) return showToast(error.message || "Status update failed");
    setSwitches((prev) => prev.map((item) => (item.id === id ? data : item)));
  }

  async function cancelSwitch(sw) {
    if (sw.email) sendSwitchEmail(sw, "cancelled");
    const { error } = await supabase.from("switches").delete().eq("id", sw.id);
    if (error) return showToast(error.message || "Failed to cancel plan");
    setSwitches((prev) => prev.filter((item) => item.id !== sw.id));
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
      if (!sw.email || sw.status !== "active" || Number(sw.remaining) > 7) return;
      const alertKey = `deadswitch-warning-${sw.id}-${sw.remaining}`;
      if (localStorage.getItem(alertKey)) return;
      localStorage.setItem(alertKey, "sent");
      sendSwitchEmail(sw, "warning");
    });
  }, [switches]);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(140deg, ${t.bg}, ${t.bg2})`, display: "grid", placeItems: "center" }}>
        <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
        <p style={{ color: t.textMuted, fontFamily: "sans-serif", fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (!session) return <AuthScreen t={t} />;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(140deg, ${t.bg}, ${t.bg2})`, color: t.text, transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,650;0,9..40,800;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        button, input, select, textarea { font-family: 'DM Sans', sans-serif; }
        button { min-width: 0; } input, select, textarea { max-width: 100%; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.84); } }
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
              {!isMobile && <p style={{ color: t.textMuted, margin: "2px 0 0", fontSize: 10, letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace" }}>{session.user.email}</p>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                <Clock size={12} />{now ? now.toLocaleTimeString() : "--:--:--"}
              </div>
            )}
            <div style={{ "--rk-radii-connectButton": "12px" }}>
              <ConnectButton showBalance={false} chainStatus={isMobile ? "none" : "icon"} accountStatus={isMobile ? "avatar" : "full"} />
            </div>
            <button onClick={() => setDark((v) => !v)} style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 13, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, cursor: "pointer" }}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <IconButton onClick={handleSignOut} title="Sign out" t={t} tone="danger"><LogOut size={15} /></IconButton>
          </div>
        </div>
      </nav>

      {isConnected && address && (
        <div style={{ background: t.accentLow, borderBottom: `1px solid ${t.accent}25`, padding: `10px ${px}px` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, color: t.accent, fontSize: 12, fontWeight: 750, fontFamily: "'DM Mono', monospace" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, display: "inline-block", animation: "pulseDot 1.8s ease infinite" }} />
            Wallet connected: {truncateWallet(address)}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: `${isMobile ? 30 : 50}px ${px}px 90px` }}>
        <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0, 0.95fr) minmax(460px, 590px)", gap: isTablet ? 28 : 52, alignItems: "start", animation: "fadeUp .45s ease" }}>
          <div style={{ maxWidth: isTablet ? 760 : 590, paddingTop: isTablet ? 0 : 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontSize: 11, fontWeight: 850, letterSpacing: "0.10em", marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, animation: "pulseDot 1.8s ease infinite" }} />
              SIMPLE CRYPTO BACKUP PLAN
            </div>
            <h1 style={{ color: t.text, fontSize: heroTitleSize, lineHeight: isMobile ? 1.04 : 1, letterSpacing: "-0.048em", margin: "0 0 20px", fontWeight: 900, maxWidth: 620 }}>
              Life happens. Your crypto should know what to do.
            </h1>
            <p style={{ color: t.textSub, fontSize: isMobile ? 15 : 17, lineHeight: 1.68, maxWidth: 510, margin: "0 0 26px" }}>
              Choose a backup wallet, set a check-in timer, and get reminded before your plan kicks in.
            </p>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginBottom: 30, maxWidth: isMobile ? "100%" : 520 }}>
              <button onClick={() => { setEditingSwitch(null); setShowModal(true); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 20px", borderRadius: 14, border: "none", background: t.text, color: t.bg, fontWeight: 900, cursor: "pointer", boxShadow: t.shadow, width: isMobile ? "100%" : "auto" }}>
                <Plus size={17} />Create my backup plan
              </button>
              <button onClick={() => setShowHowIt(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.textSub, fontWeight: 800, cursor: "pointer", width: isMobile ? "100%" : "auto", transition: "border-color 0.2s, color 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSub; }}
              >
                <LockKeyhole size={16} />How it works<ChevronRight size={15} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(0, 150px))", gap: 12, maxWidth: 500 }}>
              {[["Plans", active], ["Due soon", warnings], ["Chains", chains]].map(([label, value]) => (
                <div key={label} style={{ padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.panel }}>
                  <p style={{ color: t.text, fontSize: isMobile ? 23 : 28, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>{value}</p>
                  <p style={{ color: t.textMuted, fontSize: isMobile ? 9 : 10, fontWeight: 850, letterSpacing: isMobile ? "0.06em" : "0.12em", margin: "5px 0 0", whiteSpace: "nowrap" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", justifyContent: isTablet ? "flex-start" : "flex-end", alignSelf: "start", paddingTop: isTablet ? 0 : 4 }}>
            <AgentConsole switches={switches} nextSwitch={nextSwitch} t={t} isMobile={isMobile} />
          </div>
        </section>

        <section style={{ marginTop: isMobile ? 42 : 66 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 20 }}>
            <div>
              <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", margin: "0 0 8px" }}>YOUR PLANS</p>
              <h2 style={{ color: t.text, fontSize: isMobile ? 24 : 32, margin: 0, letterSpacing: "-0.035em" }}>Your backup plans</h2>
            </div>
            <button onClick={() => { setEditingSwitch(null); setShowModal(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px", borderRadius: 13, border: `1px solid ${t.accent}30`, background: t.accentLow, color: t.accent, cursor: "pointer", fontWeight: 850 }}>
              <Plus size={15} />New
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 50, textAlign: "center", color: t.textSub }}>Loading switches...</div>
          ) : switches.length ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 14 }}>
              {switches.map((sw) => (
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
      </main>

      <footer style={{ padding: `20px ${px}px`, borderTop: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: t.textMuted, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
          <span>DEADSWITCH</span>
          <span>Built for recovery, reminders and peace of mind</span>
        </div>
      </footer>

      {showModal && <SwitchModal onClose={() => { setShowModal(false); setEditingSwitch(null); }} onSubmit={editingSwitch ? updateSwitch : createSwitch} initialSwitch={editingSwitch} t={t} />}
      {showHowIt && <HowItWorksModal onClose={() => setShowHowIt(false)} onCreateClick={() => { setEditingSwitch(null); setShowModal(true); }} t={t} />}
    </div>
  );
}