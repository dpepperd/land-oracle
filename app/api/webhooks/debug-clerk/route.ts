// TEMPORARY diagnostic - delete after use. Never returns any key.
export const dynamic = 'force-dynamic';

export async function GET() {
  const sk = (process.env.CLERK_SECRET_KEY ?? '').trim();
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();
  let pkHost = '';
  try { pkHost = Buffer.from(pk.split('_').slice(2).join('_'), 'base64').toString('utf8').replace(/\$$/, ''); } catch {}
  let secretInstance: unknown;
  try {
    const r = await fetch('https://api.clerk.com/v1/instance', { headers: { Authorization: `Bearer ${sk}` } });
    const j: any = await r.json().catch(() => ({}));
    secretInstance = { status: r.status, environment_type: j.environment_type, error: j.errors?.[0]?.code };
  } catch (e: any) { secretInstance = { fetchError: e?.message }; }
  return Response.json({
    secretKeyPrefix: sk.slice(0, 7), secretKeyLength: sk.length, hasWhitespace: /\s/.test(process.env.CLERK_SECRET_KEY ?? ''),
    publishableKeyPrefix: pk.slice(0, 7), publishableKeyHost: pkHost, secretInstance,
  });
}
