# Throwaway #63 — Capability dispatch correlation

## Verdict

**Use a backend-issued, unguessable run lease, bound to an immutable runtime generation and exact catalog, plus a host-generated invocation ID at validated handler entry. This proves the authorized lease owner independently of provider events — but proves the originating application run only when exclusive provider-session delivery/use of that lease is enforced. That last condition is NOT proven for shared Codex/OpenCode runtimes here.**

Unique server/profile names are routing aids, not authentication. The decisive counterexample succeeds: session B using A's matching endpoint AND bearer credential looks exactly like A at the host. Therefore this prototype does **not** certify unconditional session-bound E2. Do not ship “Used by A” based merely on the existence of a run-named profile. Keep exact Resource execution with unresolved session attribution if exclusivity is unverified. #63 remains open for parent HITL review; #57 is untouched.

## Artifacts / run

All files here are throwaway, on `prototype/capability-session-correlation`; no production code, schema, route, or dependency changes.

- `index.html`: double-click; free play plus five guided walkthroughs, readable evidence table and complete model state. No server, persistence, network, or provider. Cancellation, stale-event quarantine and exclusivity are **modeled**, not provider observations.
- `probe.ts`: actual repository `createCapabilityHostServer`, real loopback HTTP/MCP SDK handling, AJV validation and deadline; inert injected Capability records entry and UUIDs in memory. No external Capability effects or secret reads.
- `run.mjs`: temporary ESM bundling using existing esbuild, needed because workspace package exports contain extensionless imports. Temporary output is removed; production files are not compiled in place.

From repository root:

```sh
npm ci --ignore-scripts                 # clean checkout only; no native modules needed
npm run build:capability-packages       # workspace types and existing focused tests
node src/main/capabilities/prototype-session-correlation/run.mjs
# Open src/main/capabilities/prototype-session-correlation/index.html
```

The probe prints scenario, HTTP/MCP response and full entry ledger. Tokens never print. It runs two run-bound host listeners in **one Node process**, sharing a logical worktree/runtime generation and tool definition. This preserves the current host's single-token API without editing it. It is NOT a live shared provider runtime, nor a proof of a multi-token single-listener implementation.

## Evidence baseline

Application source: `66e90750869893001f2f3bed0d2bcebc5708811c`. Read via `git show`, without merging:

- `research/worktree-runtime-isolation:docs/research/worktree-runtime-isolation.md` at `5d18d28157da739ac43888df3fd217dcfe058a55`.
- `research/resource-usage-signals:docs/research/resource-usage-signals.md` at `8c677e0827fa767b240a4b037e761b7d1ad39a79`.

This worktree has no graphify output. Consulted sibling `../agentic-worktrees/graphify-out/GRAPH_REPORT.md` (2026-09-02) and `graph.json` for Capability Platform Runtime navigation, then checked source; graph is navigation, not fresh implementation evidence.

Relevant source seams:

- `../capability-host-server.ts`: one token, exact `/mcp` route, per-HTTP-request MCP Server/transport, stateless session generator; unknown tool/invalid args return errors before `execute`; deadline wraps handler.
- `../capability-host-manager.ts`: existing run-owned host lifecycle/connection; credentials alone do not verify which provider session selected a connection.
- `../host-protocol.ts`: ready, secret request, capabilities applied, error; **no dispatch/outcome receipt**. Probe passes a proposed receipt through its actual schema and observes rejection.
- `../../coding-agents/opencode-capability-config.ts`: process config contains all supplied MCP credentials; generated agent profiles deny `aw_*` and allow a server prefix. A profile name/config object is not proof of exclusive runtime selection or denial across every agent/tool entry path.
- `../../coding-agents/codex-adapter.ts`, `codex-protocol.ts`, `opencode-adapter.ts`: use raw provider events before display projection. Research reports pin Codex 0.153.4 / OpenCode 1.18.30 protocols; no authenticated turns were initiated here. Deliberately avoided credential access, model charges and effects in user sessions. Thus provider evidence below is **contract-shaped fixtures plus source analysis**, not real-provider proof.

## Candidate comparison

| Candidate | Host can prove | Missing condition / failure |
|---|---|---|
| Worktree/CWD/runtime ownership, timing, titles | Nothing about originating run | Multiple runs and same-tool calls overlap; rejected outright |
| Run-scoped 256-bit bearer credential + backend lease table | Presented credential maps to exactly one authorized run and generation | Requires exclusive delivery/use; a stolen matching credential+route is indistinguishable. Never accept run identity supplied in arguments/metadata |
| Unique provider MCP server/profile | Provider event can name selected routing identity (Codex server/tool; OpenCode forward tool map) | Not a security principal. OpenCode transformations/collisions and profile switching must be denied/verified; names alone cannot bind host dispatch |
| Runtime generation | Rejects revoked leases and quarantines stale events | Orthogonal to run identity; two runs still share one generation |
| Host UUID per entered invocation | Distinct execution/attempt ledger, dedup of host receipt replay, retry separation | UUID alone does not identify run or equal provider call ID; return propagation not established |
| Pair provider structured events with host receipts | Can corroborate external session and selected server if mapping is verified | Exact concurrent call pairing needs a trusted common key. Never join by arguments, order, timing, title or assumed JSON-RPC ID equality |

Minimum proposed receipt (not implemented): trusted host source + runtime key/generation + opaque lease reference resolved backend-side to run/external session + host invocation UUID + exact Capability ID/version/digest/catalog generation + entry/outcome. The current probe emits in-memory records in an inert handler, **not** this durable host-to-main protocol. Validate a future receipt against the owned utility process and active lease; never accept renderer/provider-supplied run IDs as authority. Persist no bearer token, arguments, results or sensitive paths.

## Observed protocol scenarios

Successful local run on Node 24.3.0, MCP SDK from lockfile:

| Scenario | Observed result |
|---|---|
| A twice and B once, concurrent same tool, all JSON-RPC ID `7` | Three successful responses and three distinct host UUIDs, run closure A/A/B. Forged `_meta.claimedRun` did not change the closure identity |
| Invalid arguments / unsupported method | MCP error, entry count stays 3 (unsupported method is not unknown-tool coverage) |
| A bearer at B endpoint | HTTP 401; no entry |
| Post-entry throw | `isError:true`, fourth entry retained as failed |
| Retry | Fifth entry, new UUID despite same request ID |
| Host deadline | Sixth entry; timeout response; cooperative fixture observes abort |
| MCP cancellation notification during seventh call | Separate stateless POST receives 202; acknowledgement alone does not establish cancellation of the original request |
| Client fetch abort | Client abort observed after actual handler entry; cannot infer underlying work stopped. Host deadline remains fallback |
| B deliberately uses A endpoint plus A bearer | Accepted; eighth entry attributed to A lease. Originating session cannot be distinguished |
| Generation increment then old route | Prototype generation fence throws; no new recorded entry. **Fence lives inside fixture handler**, so this is not production pre-entry rejection and cannot erase the fact the production host entered that wrapper |
| Proposed host receipt | Existing host protocol rejects it (`safeParse.success === false`) |
| Codex/OpenCode fixture events, old generation | Provider IDs deliberately differ from `7`; HTML explains E1-only/unpaired and quarantines stale generation. No real provider event stream/history replay verified |

E2 remains validated dispatch entering the exact Capability implementation, not a success response. Pre-dispatch failures are E1 or rejection; post-entry failure/timeout/cancellation retain E2. A timeout is a boundary outcome, not proof side effects were rolled back or a non-cooperative handler stopped. The inert fixture's entry list is a probe instrument; no production telemetry was added.

## Provider pairing and unresolved gates

1. **Exclusivity is the blocking gate.** For each pinned provider, run two real sessions in one worktree provider process. Demonstrate that B cannot select A's server/profile through native tools, alternate agent/subagent, profile switching, resumed sessions, or config changes, and cannot obtain A's bearer. Codex thread MCP overrides and OpenCode permissions are candidates, not a certified answer. If a shared provider cannot enforce this, use a trusted session-aware dispatch bridge or stronger runtime isolation; do not weaken E2.
2. **Raw events:** Codex `mcpToolCall` carries server/tool and item ID with thread/turn envelope. OpenCode ToolPart has session/message/part/call IDs and transformed tool key. Preserve an invocation-time forward map; reject normalization collisions before activation. The fixture shapes omit irrelevant fields and are not SDK conformance tests.
3. **Exact call pairing:** run authorization is enough for host-side run attribution under the exclusivity contract; provider pairing is then optional corroboration, NOT required to infer host entry. To attach a particular provider call, verify a trusted echoed invocation receipt survives success, failure, cancellation and history, or provide a provider-supported request context/bridge. Current host response discards arbitrary structured output beyond content/isError; a UUID in result text is only a candidate and absent on thrown failures. No arbitrary MCP `_meta` propagation or provider/MCP ID equivalence assumed.
4. **Lifecycle:** admission must check lease/generation before implementation entry, snapshot immutable catalog ownership, revoke on replacement/termination, and define drain semantics for already-entered calls. Keep old evidence attached to its old run/generation; a late outcome may finalize only its original invocation. Retries receive new IDs; host receipt replay deduplicates by original ID. This prototype does not implement durable receipts, recovery or cancellation routing.
5. **Cancellation:** current host creates separate MCP servers per HTTP request. A notification on a new request does not share the active request's cancellation registry. Verify live transport behavior and introduce owned cancellation routing if needed; distinguish client cancelled, host aborted, host timed out and actual implementation completion.

## Verification

- `npm ci --ignore-scripts`: installed existing lockfile only; audit reported 52 existing dependency vulnerabilities; no audit-fix/dependency changes.
- `npm run build:capability-packages`: passed.
- `node src/main/capabilities/prototype-session-correlation/run.mjs`: passed; scenarios above from actual output (random UUIDs intentionally not committed).
- `npm run typecheck`: passed after workspace build.
- `npm test -- src/main/capabilities/capability-host-server.test.ts src/main/capabilities/host-protocol.test.ts`: 2 files, 10 tests passed; no prototype test suite added.
- `npm exec -- eslint src/main/capabilities/prototype-session-correlation/probe.ts`: passed.
- Existing jsdom executed inline HTML and clicked all five guided walkthroughs: passed. This verifies runnable controls, not human visual review or real browser/provider behavior.
- `git diff --check`: passed before commit.

Initial clean-checkout attempts failed from missing dependencies/workspace exports; after installing/building, direct tsx also exposed the CJS/ESM workspace packaging mismatch. The adjacent temporary bundling launcher resolves it without production edits. No renderer components/routing/styles changed; no frontend application build needed. Human review and version-pinned live-provider enforcement remain gates, not claims of success.
