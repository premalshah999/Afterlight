const encoder = new TextEncoder();
const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const same = (a, b) => { let diff = a.length ^ b.length; for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] ?? 0); return diff === 0; };
const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
};
export async function authentication(request, env) {
  const url = new URL(request.url);
  const configured = !!env.AFTERLIGHT_PASSWORD && env.SESSION_SECRET?.length >= 32;
  if (env.HOSTED && !configured) return { response: Response.json({ error: 'Workspace secrets must be configured before use.' }, { status: 503 }) };
  if (!configured) return { authenticated: true };
  if (url.pathname === '/api/login' && request.method === 'POST') {
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return { response: new Response(null, { status: 403 }) };
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return { response: new Response(null, { status: 415 }) };
    const raw = await request.text();
    if (raw.length > 2000) return { response: new Response(null, { status: 413 }) };
    let body; try { body = JSON.parse(raw); } catch { return { response: new Response(null, { status: 400 }) }; }
    if (typeof body.password !== 'string' || !same(await digest(body.password), await digest(env.AFTERLIGHT_PASSWORD))) return { response: Response.json({ error: 'Incorrect workspace password.' }, { status: 401 }) };
    const expires = String(Date.now() + 12 * 3600000);
    return { response: Response.json({ ok: true }, { headers: { 'Set-Cookie': `afterlight=${expires}.${await sign(expires, env.SESSION_SECRET)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol === 'https:' ? '; Secure' : ''}`, 'Cache-Control': 'no-store' } }) };
  }
  const token = /(?:^|;\s*)afterlight=([^;]+)/.exec(request.headers.get('Cookie') ?? '')?.[1] ?? '';
  const [expires, signature] = token.split('.');
  if (!/^\d{13}$/.test(expires ?? '') || Number(expires) <= Date.now() || Number(expires) > Date.now() + 12 * 3600000 || !signature) return { response: Response.json({ error: 'Sign in to your workspace.', login: true }, { status: 401 }) };
  if (!same(encoder.encode(signature), encoder.encode(await sign(expires, env.SESSION_SECRET)))) return { response: Response.json({ error: 'Session expired.', login: true }, { status: 401 }) };
  return { authenticated: true };
}
