const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export async function GET() {
  // Google requires this file once AdSense is active, with your real
  // publisher ID (the "pub-..." part of NEXT_PUBLIC_ADSENSE_CLIENT_ID).
  const pubId = ADSENSE_CLIENT_ID?.replace(/^ca-/, "");
  const body = pubId ? `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n` : "";

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
