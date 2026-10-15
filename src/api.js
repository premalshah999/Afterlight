import { AppError, initialState, createRelease, mutateRelease, readiness, exampleState } from './domain.js';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function api(request, store) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/releases') {
      const state = await store.get() ?? initialState();
      return json({ ...state, releases: state.releases.map(r => ({ ...r, readiness: readiness(r) })) });
    }
    if (!['POST', 'PATCH'].includes(request.method)) return json({ error: 'Not found.' }, 404);
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'Cross-origin writes are refused.' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Use application/json.' }, 415);
    const raw = await request.text();
    if (raw.length > 20_000) return json({ error: 'Request too large.' }, 413);
    const input = JSON.parse(raw);
    const state = await store.get() ?? initialState();
    if (request.method === 'POST' && url.pathname === '/api/releases') {
      if (state.releases.length >= 200) throw new AppError('Workspace limit reached. Export your release records before archiving.');
      const release = createRelease(input);
      state.releases.unshift(release); await store.set(state); return json(release, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/example') {
      if (state.releases.length) throw new AppError('Examples can only be loaded into an empty workspace.', 409);
      const example = exampleState(); await store.set(example); return json(example, 201);
    }
    const match = /^\/api\/releases\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);
    if (request.method === 'PATCH' && match) {
      const index = state.releases.findIndex(r => r.id === match[1]);
      if (index < 0) throw new AppError('Release not found.', 404);
      state.releases[index] = mutateRelease(state.releases[index], input); await store.set(state); return json(state.releases[index]);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof SyntaxError || e instanceof TypeError) return json({ error: 'Invalid request.' }, 400);
    console.error('API operation failed'); return json({ error: 'Could not save this change. Try again.' }, 500);
  }
}
