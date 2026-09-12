// THROWAWAY #64. No application imports; raw provider data stays private and is deleted.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, access, realpath } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createInterface } from 'node:readline';

const root = await realpath(await mkdtemp(join(tmpdir(), 'skill-receipt-prototype-')));
const originalHome = homedir();
const name = 'receipt-probe';
const body = 'For the harmless receipt check, answer RECEIPT_PROBE_OK. Do not run tools other than the builtin skill tool. Do not change files.';
const skill = join(root, 'skills', name, 'SKILL.md');
const children = new Set();
const report = { kind: 'observed-live-probe', node: process.version, versions: {}, authentication: 'private namespace; optional narrow existing-auth links; secrets never read by launcher', codex: {}, opencode: {} };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const dir of ['home', 'codex', 'config/opencode', 'data/opencode', 'cache', 'state', 'work', `skills/${name}`]) await mkdir(join(root, dir), { recursive: true, mode: 0o700 });
await writeFile(skill, `---\nname: ${name}\ndescription: Use for the harmless receipt check.\n---\n${body}\n`, { mode: 0o600 });
const env = { ...process.env, HOME: join(root, 'home'), CODEX_HOME: join(root, 'codex'), XDG_CONFIG_HOME: join(root, 'config'), XDG_DATA_HOME: join(root, 'data'), XDG_CACHE_HOME: join(root, 'cache'), XDG_STATE_HOME: join(root, 'state'), OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true', OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: 'true', OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_CONFIG_CONTENT: JSON.stringify({ skills: { paths: [join(root, 'skills')] }, permission: { '*': 'deny', skill: 'allow' }, plugin: [] }) };
// Deliberate opt-in: link only known CLI-owned auth stores, never copy/read credentials or user config.
if (process.argv.includes('--existing-auth')) {
  for (const [from, to] of [[join(originalHome, '.codex/auth.json'), join(root, 'codex/auth.json')], [join(process.env.XDG_DATA_HOME || join(originalHome, '.local/share'), 'opencode/auth.json'), join(root, 'data/opencode/auth.json')]]) {
    try { await access(from); await symlink(from, to); } catch { /* Missing auth is recorded by provider outcome, never fabricated. */ }
  }
}
function start(binary, args) {
  const p = spawn(binary, args, { cwd: join(root, 'work'), env, stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(p); p.stderr.resume(); p.on('error', () => { /* Spawn failure is reported by the owning probe boundary. */ }); p.once('exit', () => children.delete(p)); return p;
}
async function stop(p) { if (p.exitCode !== null) return; const done = new Promise(resolve => p.once('exit', resolve)); p.kill('SIGTERM'); await Promise.race([done, pause(1500)]); if (p.exitCode === null) { p.kill('SIGKILL'); await done; } }
function rpc(p) {
  let id = 0; const pending = new Map(); const events = [];
  createInterface({ input: p.stdout }).on('line', line => { let msg; try { msg = JSON.parse(line); } catch { return; } if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method) events.push(msg); });
  return { events, async call(method, params) { const n = ++id; const answer = new Promise(resolve => pending.set(n, resolve)); p.stdin.write(JSON.stringify({ id: n, method, params }) + '\n'); const result = await Promise.race([answer, pause(20000).then(() => ({ error: { code: 'timeout' } }))]); if (result.error) throw new Error(String(result.error.code)); return result.result; }, notify(method) { p.stdin.write(JSON.stringify({ method }) + '\n'); } };
}
async function ownFiles(dir) { const entries = await readdir(dir, { withFileTypes: true }).catch(() => []); return (await Promise.all(entries.map(e => e.isDirectory() ? ownFiles(join(dir, e.name)) : [join(dir, e.name)]))).flat(); }
async function codexProbe() {
  const p = start('codex', ['app-server']); const client = rpc(p); const out = report.codex; const sessionModes = new Map();
  try {
    await client.call('initialize', { clientInfo: { name: 'throwaway_receipt_probe', version: '1' }, capabilities: { experimentalApi: true } }); client.notify('initialized');
    await client.call('skills/extraRoots/set', { extraRoots: [join(root, 'skills')] });
    const catalog = await client.call('skills/list', { cwds: [join(root, 'work')], forceReload: true });
    out.catalogExact = catalog.data?.some(g => g.skills?.some(s => s.name === name && s.path === skill && s.enabled));
    out.probeCatalogEntryKeys = catalog.data?.flatMap(g => g.skills?.filter(s => s.name === name).map(s => Object.keys(s)) || []);
    for (const mode of ['explicit', 'automatic', 'missing-file']) {
      const t = await client.call('thread/start', { cwd: join(root, 'work'), approvalPolicy: 'never', sandbox: 'read-only', experimentalRawEvents: true });
      sessionModes.set(t.thread.id, mode);
      const begin = client.events.length;
      const input = mode === 'automatic' ? [{ type: 'text', text: 'Perform the harmless receipt check. Do not change files or run shell commands.', text_elements: [] }] : [{ type: 'skill', name, path: mode === 'missing-file' ? join(root, 'absent', 'SKILL.md') : skill }, { type: 'text', text: 'Perform the harmless receipt check. Do not change files or run shell commands.', text_elements: [] }];
      try {
        await client.call('turn/start', { threadId: t.thread.id, input });
        const deadline = Date.now() + 45000;
        while (!client.events.slice(begin).some(e => e.method === 'turn/completed') && Date.now() < deadline) await pause(200);
        const events = client.events.slice(begin);
        const history = await client.call('thread/read', { threadId: t.thread.id, includeTurns: true });
        const items = history.thread?.turns?.flatMap(t => t.items || []) || [];
        out[mode] = { submitted: true, completed: events.some(e => e.method === 'turn/completed'), eventMethods: [...new Set(events.map(e => e.method))].filter(s => /^[a-zA-Z0-9_/-]+$/.test(s)), historyItemTypes: [...new Set(items.map(i => i.type))], skillToolCalls: items.filter(i => i.type === 'mcpToolCall').map(i => ({ server: /^[a-z_]+$/.test(i.server) ? i.server : 'other', tool: /^[a-z_]+$/.test(i.tool) ? i.tool : 'other', status: i.status, resultContainsBody: JSON.stringify(i.result).includes(body) })), recordedNativeRequest: items.some(i => i.type === 'userMessage' && i.content?.some(c => c.type === 'skill' && c.name === name)), publicLoadReceipt: false };
        await client.call('thread/archive', { threadId: t.thread.id }).catch(() => { /* Best-effort cleanup inside the private namespace. */ });
      } catch (e) { out[mode] = { submitted: false, protocolErrorCode: /^[-\w]+$/.test(e.message) ? e.message : 'redacted', publicLoadReceipt: false }; }
    }
    // Read only this launcher's private rollout files; emit types/counts, never contents/paths.
    out.rollout = [];
    for (const file of (await ownFiles(join(root, 'codex'))).filter(f => f.endsWith('.jsonl'))) {
      const records = (await readFile(file, 'utf8')).split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      const mode = sessionModes.get(records.find(r => r.type === 'session_meta')?.payload?.id) ?? 'unmapped';
      const document = await readFile(skill, 'utf8');
      const injections = records.filter(r => r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'user' && r.payload.content?.some(c => typeof c.text === 'string' && c.text.includes(`<name>${name}</name>\n<path>${skill}</path>`) && c.text.includes(document) && c.text.startsWith('<skill>') && c.text.endsWith('</skill>')));
      out.rollout.push({ mode, recordTypes: [...new Set(records.map(r => r.type))], exactAssignedBodyInContext: injections.length, matchedRecordKeys: injections.map(r => Object.keys(r.payload)), matchedContentKeys: injections.flatMap(r => r.payload.content.map(c => Object.keys(c))) });
    }
  } catch (e) { out.blocked = /^[-\w]+$/.test(e.message) ? e.message : 'runtime-unavailable'; } finally { await stop(p); }
  const q = start('codex', ['app-server']); const replay = rpc(q);
  try { await replay.call('initialize', { clientInfo: { name: 'throwaway_receipt_replay', version: '1' }, capabilities: { experimentalApi: true } }); replay.notify('initialized'); out.restartHistory = [];
    for (const [id, mode] of sessionModes) { const h = await replay.call('thread/read', { threadId: id, includeTurns: true }); out.restartHistory.push({ mode, readable: Boolean(h.thread), itemTypes: [...new Set(h.thread?.turns?.flatMap(t => t.items?.map(i => i.type) || []) || [])] }); }
  } catch { out.restartBlocked = true; } finally { await stop(q); }
  out.restartRolloutExactContextInjections = 0;
  for (const file of (await ownFiles(join(root, 'codex'))).filter(f => f.endsWith('.jsonl'))) {
    const records = (await readFile(file, 'utf8')).split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const document = await readFile(skill, 'utf8');
    out.restartRolloutExactContextInjections += records.filter(r => r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'user' && r.payload.content?.some(c => typeof c.text === 'string' && c.text.includes(`<name>${name}</name>\n<path>${skill}</path>`) && c.text.includes(document) && c.text.startsWith('<skill>') && c.text.endsWith('</skill>'))).length;
  }
}
async function opencodeProbe() {
  const out = report.opencode;
  const p = start('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '0']);
  let base; let output = ''; p.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) base = match[0]; });
  const deadline = Date.now() + 30000;
  while (!base && p.exitCode === null && Date.now() < deadline) await pause(100);
  if (!base) { out.blocked = 'server-start-failed-or-timeout'; await stop(p); return; }
  const api = async (path, data) => { const r = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'x-opencode-directory': join(root, 'work') }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(45000) }); if (!r.ok) throw new Error('http-' + r.status); return r.json(); };
  const events = []; const abort = new AbortController();
  const summarize = messages => { const parts = messages.flatMap(m => m.parts || []); return { partTypes: [...new Set(parts.map(p => p.type))], builtinLoads: parts.filter(p => p.type === 'tool' && p.tool === 'skill' && p.state?.status === 'completed' && p.state.metadata?.name === name && p.state.metadata?.dir === dirname(skill) && p.state.output?.includes(body)).length, failedSkillParts: parts.filter(p => p.type === 'tool' && p.tool === 'skill' && p.state?.status === 'error').length, injectedBody: parts.some(p => p.type === 'text' && p.text?.includes(body)), assistantErrors: messages.filter(m => m.info?.error).length, errorNames: [...new Set(messages.flatMap(m => m.info?.error?.name ? [m.info.error.name] : []))], errorCategories: [...new Set(messages.filter(m => m.info?.error).map(m => { const s = JSON.stringify(m.info.error); return /auth|credential|api.key|unauthorized/i.test(s) ? 'authentication' : /fetch|connect|network|socket/i.test(s) ? 'network' : /model.*not|not.*model/i.test(s) ? 'model-unavailable' : /install|package|module|ENOENT/i.test(s) ? 'dependency-or-runtime' : 'unclassified-redacted'; }))] }; };
  const stream = (async () => { try { const r = await fetch(base + '/event', { signal: abort.signal }); let buffer = ''; for await (const chunk of r.body) { buffer += new TextDecoder().decode(chunk); let i; while ((i = buffer.indexOf('\n\n')) >= 0) { const block = buffer.slice(0, i); buffer = buffer.slice(i + 2); for (const line of block.split('\n')) if (line.startsWith('data:')) { try { events.push(JSON.parse(line.slice(5))); } catch { /* Ignore malformed provider event frames in this throwaway probe. */ } } } } } catch { /* Owned stream aborted on cleanup. */ } })();
  try {
    const catalog = await api('/skill'); const commands = await api('/command');
    out.catalogExact = catalog.some(s => s.name === name && s.location === skill);
    const command = commands.find(c => c.name === name);
    out.commandResolution = { source: command?.source ?? 'missing', templateMatches: command?.template?.endsWith(`Base directory for this skill: ${dirname(skill)}\nRelative paths in this skill (e.g., scripts/, references/) are relative to this base directory.`) && command.template.split('Base directory for this skill:')[0].trim() === body };
    const providers = await api('/provider'); out.connectedProviderCount = providers.connected?.length ?? 0;
    const providerID = providers.connected?.includes('openai') ? 'openai' : providers.connected?.[0];
    const modelID = providerID === 'openai' ? 'gpt-5.4' : providers.default?.[providerID];
    const model = providerID && modelID ? { providerID, modelID } : undefined;
    out.model = model;
    for (const mode of ['explicit-command', 'model-selected', 'missing-command']) {
      const session = await api('/session', {}); const begin = events.length;
      try {
        if (mode === 'model-selected') await api(`/session/${session.id}/message`, { model, parts: [{ type: 'text', text: 'Perform the harmless receipt check. Do not use shell commands or change files.' }] });
        else await api(`/session/${session.id}/command`, { command: mode === 'missing-command' ? 'absent-receipt-probe' : name, arguments: '', ...(model ? { model: `${providerID}/${modelID}` } : {}) });
        out[mode] = { submitted: true };
      } catch (e) { out[mode] = { submitted: false, boundary: /^http-\d+$/.test(e.message) ? e.message : 'timeout-or-runtime-error' }; }
      out[mode].history = summarize(await api(`/session/${session.id}/message`));
      out[mode].live = { eventTypes: [...new Set(events.slice(begin).map(e => e.type))], completedSkillParts: events.slice(begin).filter(e => e.type === 'message.part.updated' && e.properties?.part?.tool === 'skill' && e.properties.part.state?.status === 'completed').length };
    }
    // A real config-command collision; dispose instance to rebuild command snapshot, same private store.
    env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ skills: { paths: [join(root, 'skills')] }, command: { [name]: { template: 'Reply SHADOW_ONLY. Do not use tools.' } }, permission: { '*': 'deny' }, plugin: [] });
    out.shadowing = { nextRunRequired: true }; // Restart below to ensure environment is actually applied.
  } catch (e) { out.blocked = /^http-\d+$/.test(e.message) ? e.message : 'runtime-or-contract-error'; }
  finally { abort.abort(); await stream; await stop(p); }
  if (out.shadowing) {
    const q = start('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '0']); base = undefined; output = ''; q.stdout.on('data', chunk => { output += chunk; const m = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) base = m[0]; });
    try {
      const end = Date.now() + 30000; while (!base && q.exitCode === null && Date.now() < end) await pause(100);
      const c = (await api('/command')).find(c => c.name === name);
      out.shadowing = { source: c?.source, shadowTemplate: c?.template === 'Reply SHADOW_ONLY. Do not use tools.', assignedBodyResolved: c?.template?.includes(body) ?? false };
      const sessions = await api('/session'); const recovered = await Promise.all(sessions.map(s => api(`/session/${s.id}/message`))); out.restartHistory = { sessionCount: sessions.length, readable: true, sessionsWithAssignedBody: recovered.filter(ms => ms.some(m => m.parts?.some(p => p.type === 'text' && p.text?.includes(body)))).length, sessionsWithBuiltinLoads: recovered.filter(ms => summarize(ms).builtinLoads > 0).length };
      const s = await api('/session', {});
      try { await api(`/session/${s.id}/command`, { command: name, arguments: '' }); out.shadowing.submitted = true; } catch { out.shadowing.submitted = false; }
      const history = await api(`/session/${s.id}/message`); out.shadowing.assignedBodyInHistory = history.some(m => m.parts?.some(p => p.type === 'text' && p.text?.includes(body)));
    } catch { out.shadowing.blocked = 'restart-or-runtime-error'; } finally { await stop(q); }
  }
}
try {
  for (const binary of ['codex', 'opencode']) { try { report.versions[binary] = execFileSync(binary, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { report.versions[binary] = 'unavailable'; } }
  if (process.argv.includes('--codex') || process.argv.includes('--all')) await codexProbe();
  if (process.argv.includes('--opencode') || process.argv.includes('--all')) await opencodeProbe();
  if (!process.argv.some(a => ['--codex', '--opencode', '--all'].includes(a))) report.usage = 'node probe.mjs --all [--existing-auth]';
  console.log(JSON.stringify(report, null, 2));
} finally { for (const p of children) await stop(p); await rm(root, { recursive: true, force: true }); }
