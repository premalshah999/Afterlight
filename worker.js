import { DurableObject } from 'cloudflare:workers';
import { api } from './src/api.js';
import { authentication } from './src/auth.js';
export class LaunchWorkspace extends DurableObject {
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const auth = await authentication(request, { ...this.env, HOSTED: true });
      return auth.response ?? api(request, { get: () => this.ctx.storage.get('workspace'), set: state => this.ctx.storage.put('workspace', state) });
    });
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return Response.json({ status: 'ok', service: 'afterlight' });
    if (url.pathname === '/version') return Response.json({ revision: env.REVISION ?? 'development' });
    if (url.pathname.startsWith('/api/')) return env.WORKSPACE.getByName('primary').fetch(request);
    const response = new Response(await env.ASSETS.fetch(request));
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'same-origin');
    return response;
  },
};
