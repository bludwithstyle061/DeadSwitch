import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWarningEmail(sw, remaining) {
  const { error } = await resend.emails.send({
    from: "DeadSwitch <onboarding@resend.dev>",
    to: sw.email,
    subject: `DeadSwitch: "${sw.label}" activates in ${remaining} days`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #00D4A8;">DeadSwitch Warning</h2>
        <p>Your switch <strong>${sw.label}</strong> will activate in <strong>${remaining} days</strong>.</p>
        <p>If you're still here, log in and check in to reset your timer.</p>
        <a href="http://localhost:3000" style="display:inline-block; margin-top:16px; padding: 12px 24px; background: #00D4A8; color: #000; border-radius: 8px; text-decoration: none; font-weight: 700;">
          Check In Now
        </a>
        <p style="margin-top: 32px; color: #888; font-size: 12px;">Powered by DeadSwitch · Kite Chain</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message || JSON.stringify(error));
}

export async function GET() {
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }

  const { data: switches, error } = await supabase
    .from("switches")
    .select("*")
    .in("status", ["active", "warning"]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const sw of switches || []) {
    const currentRemaining = Number(sw.remaining);
    if (!Number.isFinite(currentRemaining)) continue;

    const nextRemaining = Math.max(0, currentRemaining - 1);
    const nextStatus = nextRemaining === 0 ? "triggered" : nextRemaining <= 7 ? "warning" : sw.status;
    const shouldWarn = Boolean(sw.email) && sw.status === "active" && nextRemaining > 0 && nextRemaining <= 7;

    if (shouldWarn) {
      try {
        await sendWarningEmail(sw, nextRemaining);
        results.push({ id: sw.id, label: sw.label, email: sw.email, warningSent: true });
      } catch (mailError) {
        results.push({ id: sw.id, label: sw.label, email: sw.email, warningSent: false, error: mailError.message });
      }
    }

    await supabase
      .from("switches")
      .update({ remaining: nextRemaining, status: nextStatus })
      .eq("id", sw.id);
  }

  return Response.json({ checked: switches?.length || 0, results });
}
