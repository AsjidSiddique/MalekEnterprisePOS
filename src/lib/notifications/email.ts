/** Email through Resend's REST API. Does nothing (and says so) until RESEND_API_KEY and EMAIL_FROM are set. */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text }),
    });
    if (!res.ok) return { ok: false, error: `Email provider returned ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email request failed." };
  }
}
