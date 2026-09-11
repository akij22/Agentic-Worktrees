// THROWAWAY #63. Run: node src/main/capabilities/prototype-session-correlation/run.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import { defineCapability, defineTool, type CapabilityDefinition } from '@agentic-worktrees/capability-sdk';
import { createCapabilityHostServer } from '../capability-host-server';
import { hostToMainMessageSchema } from '../host-protocol';

export async function main() {
  let generation = 1;
  const entries: { invocation: string; run: string; generation: number; mode: string; outcome: string }[] = [];
  const leases = await Promise.all(['A', 'B'].map(async run => {
    const token = randomBytes(32).toString('hex');
    const leaseGeneration = generation;
    const capability = defineCapability({
      manifest: { id: 'prototype.echo', name: 'Throwaway', version: '0.1.0', sdkVersion: '^0.1.0', description: 'Local probe only', category: 'test', author: { name: 'Prototype' }, license: 'MIT', compatibility: { codex: 'supported', opencode: 'supported' }, permissions: { network: [], secrets: [] }, settings: {} },
      tools: [defineTool<{ mode: string }>({ name: 'probe', description: 'No external effects', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['ok', 'fail', 'wait'] } }, required: ['mode'], additionalProperties: false }, execute: async ({ mode }, context) => {
        // Stand-in for a host admission generation fence, NOT production behavior.
        if (leaseGeneration !== generation) throw new Error('Revoked generation');
        const entry = { invocation: randomUUID(), run, generation: leaseGeneration, mode, outcome: 'entered' };
        entries.push(entry);
        if (mode === 'fail') { entry.outcome = 'failed'; throw new Error('Post-entry failure'); }
        if (mode === 'wait') await new Promise<void>(resolve => {
          context.signal.addEventListener('abort', () => { entry.outcome = 'aborted'; resolve(); }, { once: true });
        });
        else entry.outcome = 'success';
        return { content: [{ type: 'text', text: entry.invocation }] };
      } })],
    });
    // Two transport/auth scopes, ONE logical worktree runtime and catalog. No provider process.
    // Current host supports one token only; a shared-listener token registry is NOT implemented.
    const host = createCapabilityHostServer({ token, executionTimeoutMs: 150, resolveSecret: async () => undefined, registry: async () => capability as CapabilityDefinition });
    await host.setActiveCapabilities([{ kind: 'bundled', capabilityId: 'prototype.echo', version: '0.1.0' }]);
    return { run, token, host, port: await host.start() };
  }));
  const [a, b] = leases;
  async function call(lease: typeof a, args: unknown, token = lease.token, method = 'tools/call', signal?: AbortSignal) {
    const response = await fetch(`http://127.0.0.1:${lease.port}/mcp`, { method: 'POST', signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params: method === 'tools/call' ? { name: 'probe', arguments: args, _meta: { claimedRun: 'FORGED' } } : args }) });
    return { status: response.status, body: await response.text() };
  }
  function show(scenario: string, result: unknown) { console.log(JSON.stringify({ scenario, result, entries }, null, 2)); }
  try {
    show('concurrent identical tool/JSON-RPC IDs, two runs', await Promise.all([call(a, { mode: 'ok' }), call(a, { mode: 'ok' }), call(b, { mode: 'ok' })]));
    show('invalid arguments: no entry', await call(a, { mode: 123 }));
    show('unknown tool/method: no entry', await call(a, {}, a.token, 'unknown/method'));
    show('wrong credential at B route: 401, no entry', await call(b, { mode: 'ok' }, a.token));
    show('post-entry failure remains E2', await call(a, { mode: 'fail' }));
    show('retry is new invocation', await call(a, { mode: 'ok' }));
    show('host deadline after entry', await call(b, { mode: 'wait' }));
    const controller = new AbortController();
    const pending = call(a, { mode: 'wait' }, a.token, 'tools/call', controller.signal).catch(() => ({ client: 'aborted; not proof of host cancellation' }));
    // Wait on actual entry, not elapsed-time inference of identity.
    while (entries.at(-1)?.run !== 'A' || entries.at(-1)?.mode !== 'wait') await new Promise(resolve => setImmediate(resolve));
    const notification = await fetch(`http://127.0.0.1:${a.port}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7, reason: 'prototype' } }) });
    show('MCP cancellation on separate stateless request', { status: notification.status, body: await notification.text() });
    controller.abort();
    show('client disconnect', await pending);
    // Stolen matching credential+route is accepted: bearer auth proves possession, not originating session.
    show('B impersonates A using A route AND credential: indistinguishable', await call(a, { mode: 'ok' }));
    generation++;
    show('stale generation: prototype fence prevents new recorded entry', await call(a, { mode: 'ok' }));
    show('current host protocol cannot carry proposed dispatch receipt', hostToMainMessageSchema.safeParse({ type: 'host.invocation.entered', runId: 'A', invocationId: 'fixture' }).success);
    const fixtures = [
      { provider: 'codex', threadId: 'thread-A', turnId: 'turn-1', item: { type: 'mcpToolCall', id: 'provider-item-not-7', server: 'profile-A-g1', tool: 'probe' } },
      { provider: 'opencode', sessionID: 'session-B', messageID: 'message-1', id: 'part-1', callID: 'provider-call-not-7', tool: 'profile_B_g1_probe' },
    ];
    show('structured provider fixtures: E1 only; no exact concurrent-call join key; stale g1 cannot update g2', fixtures);
  } finally { await Promise.all(leases.map(lease => lease.host.close())); }
}
