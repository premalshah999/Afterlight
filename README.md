# Afterlight

**A launch room for teams who want a reason to say “ready.”**

Afterlight brings launch checks, owners, evidence and the final go/no-go decision into one workspace. Choose a product, hotfix or campaign template, collect the proof, resolve blockers and lock the launch decision. It is a working single-workspace pilot with persistent storage, not a static dashboard.

## Run

Node 22.19+ (24 recommended). The application has no runtime dependencies.

```sh
node server.js
```

Open http://127.0.0.1:4321. The workspace starts empty. An optional interactive example is explicitly labeled as illustrative. Real releases start with no evidence or completed checks. State is saved atomically in `.afterlight/state.json` (ignored by Git). Use `PORT` and `AFTERLIGHT_DATA` to override the port and state-file path. Bind address is loopback only.

## Verify

```sh
corepack pnpm install --frozen-lockfile
npm test
npm run check
corepack pnpm exec playwright install chromium
npm run test:browser
```

`atlas.config.json` lets ATLAS independently execute tests, syntax checks, health and HTTP security checks, a browser journey through a blocked and then approved launch, persistence on navigation, and local staging with exact Git revision readback. Screenshots and commands are attached to the ATLAS mission, not invented for the README.

## Product behavior

- Three release templates, with owners, deadlines, priorities and custom checks.
- Required and blocking checks cannot complete without an HTTP/HTTPS evidence URL. Embedded credentials and non-web URL schemes are rejected.
- Launch is refused until every required/blocking check is complete and supported by evidence. Optional checks may remain open.
- Launching locks the release and saves a separate snapshot of all checks. Later writes are refused.
- Every mutation appends an activity event. Stale revisions return HTTP 409 instead of overwriting another person's changes.
- Evidence library, search, status filters, JSON release export, responsive layouts and keyboard shortcuts.
- Hosted access uses a shared workspace password and signed HttpOnly, Secure, SameSite cookies. Local mode trusts the machine's loopback user.

## Cloudflare

The same application runs on Workers with static assets and a SQLite-backed Durable Object. The object serializes workspace operations; local Node uses an atomic JSON file and a mutation queue.

```sh
corepack pnpm exec wrangler login
corepack pnpm exec wrangler secret put AFTERLIGHT_PASSWORD
corepack pnpm exec wrangler secret put SESSION_SECRET
corepack pnpm exec wrangler deploy --var REVISION:$(git rev-parse HEAD)
```

Use a strong workspace password and a random session secret of at least 32 characters. Hosted API requests fail closed until both are set. Never commit secrets or `.dev.vars`. Back up the Durable Object before retiring its deployment. Source snapshots can separately be published to Cloudflare Artifacts from the ATLAS mission.

## Boundaries

This pilot uses one shared workspace, not individual accounts or role-based permissions. The activity trail identifies the launch owner, not an independently authenticated actor. Evidence is a team-supplied link; Afterlight does not attest to the linked contents. Shipment snapshots are immutable through the application API, not cryptographic external attestations. There is no file upload, billing, email, telemetry, external link fetching or background monitoring. A private pilot should precede a broad public rollout.

## Architecture

- `src/domain.js`: validated, immutable release transitions and readiness calculation.
- `src/api.js`: storage-independent Fetch API router; rejects cross-origin writes.
- `src/auth.js`: password check and HMAC session verification.
- `server.js`: loopback Node HTTP/file adapter.
- `worker.js`: Worker assets and Durable Object adapter.
- `public/`: semantic HTML, CSS and browser JavaScript; no frontend framework or external asset requests.
- `test/`: behavior, security and browser checks.

MIT licensed.
