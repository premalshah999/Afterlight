export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const templates = {
  product: [
    ['Core journey works end to end', 'Engineering', 'blocker', true],
    ['Permissions and data boundaries checked', 'Engineering', 'blocker', true],
    ['Mobile and keyboard experience checked', 'Design', 'high', true],
    ['Launch copy and announcement approved', 'Marketing', 'normal', true],
    ['Rollback plan is documented', 'Operations', 'blocker', true],
    ['Support handoff is ready', 'Operations', 'normal', false],
  ],
  hotfix: [
    ['Regression reproduced and covered', 'Engineering', 'blocker', true],
    ['Fix verified in staging', 'Engineering', 'blocker', true],
    ['Rollback and incident note ready', 'Operations', 'high', true],
  ],
  campaign: [
    ['Landing page and conversion flow checked', 'Marketing', 'blocker', true],
    ['Creative and messaging approved', 'Design', 'high', true],
    ['Tracking and consent checked', 'Operations', 'blocker', true],
  ],
};
const text = (v, field, max = 200) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new AppError(`${field} is required and must be under ${max + 1} characters.`);
  return v.trim();
};
export function evidenceUrl(value) {
  const raw = text(value, 'Evidence URL', 2000);
  let u;
  try { u = new URL(raw); } catch { throw new AppError('Use a complete https:// or http:// evidence URL.'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new AppError('Evidence must be an HTTP or HTTPS URL without embedded credentials.');
  return u.href;
}
export function readiness(release) {
  const missing = release.checks.filter(c => (c.required || c.priority === 'blocker') && (c.status !== 'done' || !c.evidence));
  const complete = release.checks.filter(c => c.status === 'done').length;
  return { ready: missing.length === 0 && release.checks.length > 0, missing: missing.map(c => c.id), complete, total: release.checks.length, percent: release.checks.length ? Math.round(complete / release.checks.length * 100) : 0 };
}
export function createRelease(input, id = crypto.randomUUID()) {
  const title = text(input.title, 'Release name', 100);
  const owner = text(input.owner, 'Launch owner', 70);
  const date = text(input.date, 'Launch date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new AppError('Choose a valid launch date.');
  const template = input.template ?? 'product';
  if (!Object.hasOwn(templates, template)) throw new AppError('Unknown release template.');
  return { id, title, owner, date, description: typeof input.description === 'string' ? input.description.trim().slice(0, 1000) : '', template, status: 'active', version: 1, createdAt: new Date().toISOString(), shippedAt: null, checks: templates[template].map(([title, team, priority, required]) => ({ id: crypto.randomUUID(), title, team, priority, required, owner: '', status: 'todo', evidence: '', note: '' })), audit: [{ id: crypto.randomUUID(), at: new Date().toISOString(), message: `${owner} opened the launch room.`, type: 'created' }] };
}
export function mutateRelease(release, input) {
  if (input.version !== release.version) throw new AppError('This release changed in another window. Refresh and try again.', 409);
  if (release.status === 'shipped') throw new AppError('Shipped releases are locked. Create a new release for further changes.', 409);
  const next = structuredClone(release);
  let message, type;
  if (input.action === 'check') {
    const check = next.checks.find(c => c.id === input.checkId);
    if (!check) throw new AppError('Check not found.', 404);
    if (!['todo', 'doing', 'done'].includes(input.status)) throw new AppError('Invalid check status.');
    const evidence = input.evidence?.trim() ? evidenceUrl(input.evidence) : '';
    if (input.status === 'done' && (check.required || check.priority === 'blocker') && !evidence) throw new AppError('Attach evidence before completing a required or blocking check.');
    check.status = input.status; check.evidence = evidence;
    check.owner = typeof input.owner === 'string' ? input.owner.trim().slice(0, 70) : check.owner;
    check.note = typeof input.note === 'string' ? input.note.trim().slice(0, 2000) : check.note;
    message = `${check.title} → ${input.status === 'done' ? 'complete' : input.status === 'doing' ? 'in progress' : 'to do'}.`; type = 'check';
  } else if (input.action === 'add') {
    const priority = input.priority ?? 'normal';
    if (!['normal', 'high', 'blocker'].includes(priority)) throw new AppError('Invalid priority.');
    if (next.checks.length >= 100) throw new AppError('A launch room supports up to 100 checks.');
    next.checks.push({ id: crypto.randomUUID(), title: text(input.title, 'Check title', 150), team: text(input.team ?? 'Engineering', 'Team', 50), priority, required: input.required !== false, owner: '', status: 'todo', evidence: '', note: '' });
    message = `Added check: ${next.checks.at(-1).title}.`; type = 'added';
  } else if (input.action === 'ship') {
    if (!readiness(next).ready) throw new AppError('Launch blocked: finish every required and blocking check with evidence.', 409);
    next.status = 'shipped'; next.shippedAt = new Date().toISOString();
    next.shipment = { at: next.shippedAt, owner: next.owner, checks: structuredClone(next.checks) };
    message = `${next.owner} approved the launch. Evidence snapshot locked.`; type = 'shipped';
  } else throw new AppError('Unknown action.');
  next.version++;
  next.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), message, type });
  return next;
}
export function initialState() { return { schema: 1, releases: [] }; }
export function exampleState() {
  const r = createRelease({ title: 'Orbit 2.0 · Public launch', owner: 'Alex Morgan', date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), description: 'A calmer workspace for ambitious teams. One launch, every detail accounted for.', template: 'product' }, 'example-orbit');
  r.example = true;
  r.checks.forEach((c, i) => { c.owner = ['Sam Chen', 'Alex Morgan', 'Maya Patel', 'Jules Park', 'Alex Morgan', 'Jules Park'][i]; c.status = i < 2 ? 'done' : i < 4 ? 'doing' : 'todo'; c.evidence = i < 2 ? 'https://example.com/demo-evidence' : ''; c.note = i < 2 ? 'Illustrative evidence only. This is an example workspace.' : ''; });
  return { schema: 1, releases: [r] };
}
