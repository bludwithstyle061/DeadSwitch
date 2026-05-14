import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const { email, label, remaining, type = "warning" } = await request.json();

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: "Missing RESEND_API_KEY in .env.local" }, { status: 500 });
  }

  const templates = {
    created: {
      eyebrow: "Switch armed",
      subject: `DeadSwitch: "${label}" is now active`,
      body: `
        <p>Your switch <strong>${label}</strong> has been created successfully.</p>
        <p>DeadSwitch is now watching the timer and will notify you as the deadline gets close.</p>
      `,
      cta: "Open DeadSwitch",
    },
    cancelled: {
      eyebrow: "Switch cancelled",
      subject: `DeadSwitch: "${label}" was cancelled`,
      body: `
        <p>Your switch <strong>${label}</strong> has been cancelled.</p>
        <p>The timer is no longer active and DeadSwitch will not send deadline alerts for this switch.</p>
      `,
      cta: "Open DeadSwitch",
    },
    warning: {
      eyebrow: "Deadline warning",
      subject: `DeadSwitch: "${label}" activates in ${remaining} days`,
      body: `
        <p>Your switch <strong>${label}</strong> will activate in <strong>${remaining} days</strong>.</p>
        <p>If you're still here, log in and check in to reset your timer.</p>
      `,
      cta: "Check In Now",
    },
  };

  const template = templates[type] || templates.warning;

  const { data, error } = await resend.emails.send({
    from: "DeadSwitch <onboarding@resend.dev>",
    to: email,
    subject: template.subject,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 34px; background: #07080D; color: #F4F7FB; border-radius: 18px;">
        <p style="color: #00D4A8; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; margin: 0 0 14px;">${template.eyebrow}</p>
        <h2 style="color: #F4F7FB; font-size: 26px; line-height: 1.1; margin: 0 0 18px;">DeadSwitch Alert</h2>
        <div style="color: #B8C0D0; font-size: 15px; line-height: 1.7;">
          ${template.body}
        </div>
        <a href="http://localhost:3000" style="display:inline-block; margin-top:16px; padding: 12px 24px; background: #00D4A8; color: #000; border-radius: 8px; text-decoration: none; font-weight: 700;">
          ${template.cta}
        </a>
        <p style="margin-top: 32px; color: #667085; font-size: 12px;">Powered by DeadSwitch / Kite Chain</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend failed:", error);
    return Response.json({ error: error.message || JSON.stringify(error) }, { status: 400 });
  }

  return Response.json({ data });
}
