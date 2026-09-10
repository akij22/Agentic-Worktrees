# Trustworthy Resource usage signals

Resolution of [research ticket #59](https://github.com/akij22/agentic-worktrees/issues/59), supporting #57. Research only; no implementation or product scope expansion.

## Answer

**Do not derive Used from Installed, Enabled, discovery, permissions, model prose, or submission success.** Preserve three independent facts: what was requested, what actually executed/loaded, and whether attribution to an assigned Resource is exact.

- **Capability Used:** a real, exactly attributed MCP tool invocation. Recommend the conservative threshold of host dispatch entering the Capability implementation after validation. Record an addressed request separately; rejection or approval denial does not establish execution. Execution that subsequently fails still counts as Used, with a failed outcome.
- **Skill Used:** reliable provider/runtime evidence that the identified Skill's instruction body was loaded into that session's model context. This does **not** claim that the model obeyed the instructions or achieved the task. An explicit request alone is not loading evidence.
- **Automatic Skill use:** report only a positively identified load; otherwise **unknown/not observed**, not unused. A load's existence and whether it was explicit or automatic are separate questions.

These are recommended evidence semantics. The current application cannot meet them uniformly: the host has no invocation telemetry, normalized provider messages lose provenance, and persisted Skill `loaded` rows are based on bridge completion rather than a load acknowledgement. [R1–R5]

## Scope and reproducibility

Inspected application source at HEAD [`66e90750869893001f2f3bed0d2bcebc5708811c`](https://github.com/akij22/agentic-worktrees/tree/66e90750869893001f2f3bed0d2bcebc5708811c), independently of uncommitted changes. The existing graph/report identified Capability Runtime, Coding Agent Services, and Skill persistence as navigation areas; conclusions below are grounded in source, not graph inference.

Observed installed versions: **Codex CLI 0.153.4**, **OpenCode CLI 1.18.30**, **OpenCode SDK 1.17.18**, **MCP SDK 1.30.0**. Codex types were generated with `codex app-server generate-ts --experimental --out <temporary-directory>` and checked against its release's generated types. OpenCode `dist/v2/gen/types.gen.d.ts` was inspected in the installed SDK; provider behavior was checked against upstream **v1.18.30** source. The SDK/CLI mismatch is a compatibility risk, not proof that a field is delivered by the running integration. No authenticated provider turns were executed. [C1–C3, O1–O4]

## Strict evidence levels

| Level | Capability | Skill | Safe interpretation |
|---|---|---|---|
| E0: available | Installed/active descriptor, MCP discovery, healthy connection | Installed catalog, `skills/list`, enabled root, automatic-invocation flag | Available, not Used |
| E1: requested/addressed | Provider MCP item/tool part naming a tool; approval request | Native Skill input, explicit command submission, pending `skill` tool | Attempted/requested; no execution/load claim |
| E2: confirmed | Trusted host dispatch past validation into the exact Capability handler | Trusted provider load result or runtime context-injection record identifying the exact Skill | Used, if session and Resource attribution are exact |
| E3: outcome | Handler success, failure, cancellation or timeout following E2 | Load completed or failed; later task outcome is separate | Outcome does not erase earlier confirmed use |
| Unknown/ambiguous | Missing lifecycle or non-unique mapping | Missing load receipt, unresolved command/name/path identity | Never promote by inference |

A provider tool status is evidence of that **provider's state**, not automatically E2. In particular, MCP `isError: true` can represent either pre-dispatch rejection or an error after execution. A permission approval, elapsed duration, token increase, or successful turn is not a substitute for the missing boundary. A failed load attempt does not prove Skill instructions reached model context. [R1, C1, O1, M1]

## Capability signals and attribution

### Codex

Installed/generated `ThreadItem` has a dedicated `mcpToolCall` variant containing `id`, **`server` and `tool` separately**, `status`, `arguments`, `result`, and `error`. `item/started` and `item/completed` notifications carry the item with `threadId` and `turnId`; `item/mcpToolCall/progress` is progress, not success. Persisted thread items can supply retrospective provider evidence when live events were missed. The protocol also contains `dynamicToolCall` and native `webSearch`; neither should be relabeled as one of this application's hosted Capabilities based on a similar name. [C1, C2]

Keep the raw `(server, tool)` pair and the mapping valid at call time. An MCP item proves a provider-side attempt; a declined/failed item may never reach the host. A successful result from this known host is useful corroboration, but collecting host dispatch is the uniform way to distinguish execution from pre-dispatch errors and retain failed genuine invocations. [R1]

The application's `readCodexToolCall` currently replaces this with `tool: "mcp"`, a combined display title, normalized status and empty detail. It also turns native web search into `tool: "web_search"`. **Do not parse these presentation strings back into provenance.** Consume structured items before projection. The installed protocol has richer live events than the application's normalized message contract; lack of a normalized field is not lack of a provider event. [R3, R5, C1, C2]

### OpenCode

Installed SDK `ToolPart` carries `sessionID`, `messageID`, part `id`, `callID`, `tool`, and `state`. `ToolStateCompleted` carries input, output, metadata and timing; the error variant carries input/error and optional metadata. `message.part.updated` supplies a part; session message history is the retrospective counterpart. Pending/running/completed/error remain provider states, not host entry receipts. The application reduces parts to display-oriented tool calls and does not retain a typed server/Capability identity in that projection. [O1, R4, R5]

OpenCode v1.18.30 constructs its model-facing MCP name as:

```text
sanitize(serverName) + "_" + sanitize(toolName)
sanitize(x) = replace characters outside [a-zA-Z0-9_-] with "_"
```

This is **not reversible or collision-free**: `(a_b, c)` and `(a, b_c)` both become `a_b_c`; `a.b` and `a_b` sanitize alike. The runtime tool registry uses these generated names as object keys. Preserve a forward mapping from the actual registered runtime catalog; never split on underscores or match suffixes. Reject collisions before activation, or report ambiguous attribution if uniqueness cannot be established. [O3]

### MCP host: strongest execution boundary, currently unreported

The host's `activeTools` map stores the exact Capability definition alongside each tool and validator. `setActiveCapabilities` rejects duplicate raw tool names before swapping the active map. Thus a successfully installed host catalog has a unique local tool owner; this does not prevent OpenCode's cross-server/sanitization collisions. Capture the descriptor/version/content digest and catalog generation at dispatch, not from today's installation state. [R1, R6]

`CallToolRequestSchema` handling checks the name and validates arguments before calling `entry.tool.execute`. Unknown/inactive names and invalid input return `isError: true` **without entry**. The ideal E2 event is at the actual dispatch boundary; outcome events follow success/exception/timeout/cancellation. MCP discovery, host readiness, active tool lists and secret requests are not substitute invocation records. [R1, R2]

The current host-to-main union contains only `host.ready`, `host.secret.request`, `host.capabilities.applied`, and `host.error`. No call receipt or outcome is emitted. Its HTTP transport uses `sessionIdGenerator: undefined`; MCP transport state does not identify an application session. JSON-RPC request IDs correlate a request/response within a connection context, not globally across provider sessions. A host-only observation must not be assigned to a session merely because it shares a worktree/runtime. Require verified provider correlation or an authenticated, session-bound routing/correlation mechanism; otherwise retain exact Resource but unknown session attribution. [R1, R2, M1]

Here **Resource means the application's Capability-or-Skill union**, not MCP's separate resource-URI primitive. `resources/list`, resource links, subscriptions or resource reads do not meet the Capability tool-invocation rule. Do not introduce an MCP-resource activity feature to resolve this ticket. [M1, M2]

## Skill signals: explicit versus automatic

### Codex

The adapter sends native `{ type: "skill", name, path }` in `turn/start`, with optional arguments as text. This is an exact explicit **request** when the path is resolved against the assigned immutable Skill version; a persisted `userMessage.content` Skill entry similarly confirms provider-recorded input, not successful instruction loading. `skills/list`, `skills/changed` and root configuration describe discovery/catalog changes, not session use. [R7, C2, C3]

The inspected `ThreadItem` and `ServerNotification` unions have **no dedicated, universal Skill-loaded item/notification**. Do not infer automatic loading from shell commands mentioning `SKILL.md`, a read-looking command, a Skill name in assistant prose, or the model completing a task. Such observations may be diagnostic leads but do not establish exact catalog identity and successful context injection. Explicit Codex Used therefore remains unconfirmed unless a tested runtime boundary supplies a positive load/injection receipt. This is a gap in the inspected integration/protocol surface, not a claim that Codex internally cannot load Skills. [C1–C3, R7]

### OpenCode automatic/model-selected loading

Upstream v1.18.30's builtin **`skill` tool** accepts `name`, resolves the Skill, asks permission, then returns its instruction body wrapped in `skill_content`, with `metadata.name` and `metadata.dir`, and title `Loaded skill: …`. A completed **trusted builtin** tool part with this structured identity mapped to the assigned Skill version is useful E2 evidence of loading into the tool-result path. Pending/error/permission events alone are not. Prefer structured metadata plus verified runtime registry ownership; a title or arbitrary tool output can imitate the same text. Do not persist/expose the raw directory or instruction body merely to render usage. [O1, O2]

This can observe model-selected loading even without an application explicit invocation. However, absence of a matching local request alone does not prove automatic intent: commands, provider-side input, or another explicit route may have caused it. Keep `mode: unknown` unless the invocation path is known; label automatic only for a positively identified model-selected path under the controlled runtime contract. [O2, O4]

### OpenCode explicit commands are a different path

The adapter calls `session.command` with the Skill ID, not the builtin `skill` tool. Upstream command registration makes Skills into commands with `source: "skill"` and a template containing the Skill body; **an existing command with that name wins and the Skill command is skipped**. Therefore successful `session.command(name)` is not sufficient to establish that the named Skill was loaded. Catalog verification of Skill names/paths alone does not verify command resolution. [R4, O4]

`command.executed` contains name, session ID, arguments and resulting message ID, but no Skill path/version or command source. Upstream publishes it after the command prompt returns. It can support E2 only together with a verified command-resolution snapshot (`source: "skill"`, exact assigned Skill/version/template) and the correlated provider message/injection record. A completed builtin `skill` ToolPart is **not required** for this explicit template-injection path and may never occur. Reject shadowed explicit Skill commands or surface them as unresolved; never call another command's success Skill Used. [O1, O4]

## Persisted-session evidence and historical limits

- Provider-native Codex thread items and OpenCode message parts are better reconciliation inputs than rendered transcripts. Preserve thread/session, turn/message, item/part and call IDs before the application drops structure. Deduplicate live and history observations by their scoped provider identity; a retry with a new call ID is a new attempt. History supplies only fields actually retained by the provider, not an audit guarantee after deletion/compaction. [C1, C2, O1, R3–R5]
- `SkillService.invokeSkill` creates an explicit invocation, awaits `runtime.invoke`, and immediately transitions to **`loaded`** when that bridge resolves. There is no check for the load evidence above. Treat existing rows as **legacy bridge-completed**, not verified Used. Their `failed` state likewise does not identify the precise provider failure boundary. [R8]
- Session Capability configuration/activation is availability state, not per-tool execution history. A normalized tool title or today's catalog cannot recover an old version/digest or a missing server mapping. Unknown historical attribution should remain unknown; do not backfill Used from assignments. [R3, R5, R9]
- Missing live evidence is not proof of non-use. Reconcile provider history where available, and record coverage gaps after restart/reconnect instead of fabricating a complete negative history. The existing normalized DTO is not a durable evidence ledger. [R4, R5]

## Recommendation and unresolved implementation contracts

Adopt the E2 threshold above and retain E1 as **requested/attempted**, separate from outcome. Implement in existing main-process runtime/adapters; no new UI surfaces are implied.

1. Add host dispatch/outcome evidence and **prove session correlation** before attributing activity to a session. Shared runtime/worktree ownership is insufficient. Do not assume the providers forward arbitrary custom MCP metadata: verify a supported propagation or session-bound route first.
2. Preserve structured Codex and OpenCode identities before display projection. Snapshot the active forward tool mapping and Skill/command resolution, with collision checks. An exact match requires one Resource in the invocation-time catalog, never a suffix/display-name heuristic.
3. Persist a minimal evidence envelope: provider/version, runtime generation, application session/run, external session/thread, available turn/message/item/part/call IDs, Resource kind/ID/version/digest, catalog generation, original server/tool or Skill identity, source event/boundary, evidence level, outcome, mode, timestamp and attribution confidence. Provider call IDs and MCP request IDs are not assumed equal. Internal path resolution can establish Skill identity; store an opaque reference/digest rather than exposing local paths.
4. For OpenCode, support both builtin Skill-load evidence and verified explicit command injection. For Codex, keep explicit requests visible as requests while establishing a tested load receipt; automatic Used remains unknown without reliable evidence. Do not loosen the definition to make provider parity appear complete.
5. Reconcile persisted provider records and migrate legacy `loaded` semantics conservatively. Store only validated, minimal provenance—not raw prompts, arguments/results, credentials, host authorization headers or private filesystem paths.

Remaining gates: session-to-host correlation; version-tested Codex load acknowledgement; OpenCode command shadowing and transformed-name collisions; SDK/CLI compatibility; durable reconciliation/coverage; and exact invocation-time version identity. Verify with real-provider fixtures covering a successful Capability, pre-dispatch rejection, post-entry failure, permission denial, both explicit Skill routes, observable automatic loading, collisions, and reconnect/history replay. This source-only research does not certify those runtime behaviors end to end.

## Primary sources

Repository references below are pinned to the inspected HEAD:

- [R1 — MCP host dispatch, validation, stateless transport and duplicate-name guard](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/capabilities/capability-host-server.ts#L148-L341)
- [R2 — host-to-main protocol](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/capabilities/host-protocol.ts#L123-L165)
- [R3 — Codex message/tool projection](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/coding-agents/codex-protocol.ts#L327-L489)
- [R4 — OpenCode adapter: ToolPart projection, explicit commands, message retrieval and event stream](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/coding-agents/opencode-adapter.ts)
- [R5 — normalized provider contracts](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/coding-agents/types.ts#L19-L103)
- [R6 — verified runtime descriptor/definition identity](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/capabilities/host-registry.ts)
- [R7 — Codex catalog verification and native Skill turn input](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/coding-agents/codex-adapter.ts#L233-L289)
- [R8 — Skill invocation persistence transition](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/skills/skill-service.ts#L324-L389)
- [R9 — Capability configuration/activation persistence](https://github.com/akij22/agentic-worktrees/blob/66e90750869893001f2f3bed0d2bcebc5708811c/src/main/capabilities/capability-repository.ts)

Provider release source and installed contracts:

- [C1 — Codex 0.153.4 generated ThreadItem](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts)
- [C2 — Codex 0.153.4 notification union](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/app-server-protocol/schema/typescript/ServerNotification.ts), [item-start envelope](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/app-server-protocol/schema/typescript/v2/ItemStartedNotification.ts), [item-complete envelope](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/app-server-protocol/schema/typescript/v2/ItemCompletedNotification.ts)
- [C3 — Codex 0.153.4 UserInput](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/app-server-protocol/schema/typescript/v2/UserInput.ts)
- O1 — installed `@opencode-ai/sdk@1.17.18/dist/v2/gen/types.gen.d.ts`: `ToolPart` (389–400), `ToolStateCompleted` (357–373), `EventMessagePartUpdated` (5318–5326), `EventCommandExecuted` (5925–5934). [Published package artifact](https://unpkg.com/@opencode-ai/sdk@1.17.18/dist/v2/gen/types.gen.d.ts) (distribution of the provider's generated contract, not a secondary account).
- [O2 — OpenCode v1.18.30 builtin Skill loader](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/tool/skill.ts#L12-L68)
- [O3 — OpenCode MCP name transformation](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/mcp/catalog.ts#L117-L119), [tool registry construction](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/mcp/index.ts#L668-L687)
- [O4 — OpenCode command precedence and Skill templates](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/command/index.ts#L65-L151), [command prompt and executed event](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/session/prompt.ts#L1290-L1480)
- [M1 — official MCP tools specification, including tools/call and error handling](https://modelcontextprotocol.io/specification/2025-11-25/server/tools); installed `@modelcontextprotocol/sdk@1.30.0` supplies `CallToolRequestSchema`/`ListToolsRequestSchema`, as used directly by R1.
- [M2 — official MCP resources specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)
