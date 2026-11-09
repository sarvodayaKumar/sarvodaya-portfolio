type ResendResponse = { id?: string; message?: string };

export async function sendAdminMfaEmailCode(code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_EMAIL_FROM;
  const recipient = process.env.ADMIN_USERNAME;
  if (!apiKey || !from || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: "Your administrator sign-in code",
        text: `Your one-time administrator sign-in code is ${code}. It expires in five minutes. If you did not request this code, ignore this email.`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = await response.json().catch(() => ({})) as ResendResponse;
    return typeof result.id === "string" && result.id.length > 0;
  } catch {
    return false;
  }
}
