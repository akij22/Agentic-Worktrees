# Throwaway #64 — Provider-native Skill usage receipts

## Verdict

**Provider parity is possible for explicit Skill use, but not through the current normalized adapter contract.** Codex 0.154.0 writes an exact Skill context-injection record to its private rollout; OpenCode 1.18.30 exposes exact command injection and trusted builtin `skill` ToolPart evidence. Public Codex thread items prove only the native request, and automatic Codex loading remains unknown.

Do not treat bridge completion, catalog discovery, command submission, provider prose, token use, or a later successful task as Used. Promote only version-qualified evidence that matches the application session, immutable assigned Skill identity/version/digest, runtime/catalog generation and complete instruction body at the provider context boundary.

## Artifacts and usage

This directory is throwaway prototype evidence on branch `prototype/provider-skill-usage-receipts`; it contains no production edits or persistence.

- `index.html` — double-clickable evidence reducer with twelve guided scenarios.
- `probe.mjs` — private-namespace Codex/OpenCode protocol and live-runtime probe.
- `observed.json` — sanitized summary of the two reviewed probe runs; no prompts, Skill contents, tokens or private paths.

From the repository root:

```sh
node src/main/skills/prototype-usage-receipts/probe.mjs --all
node src/main/skills/prototype-usage-receipts/probe.mjs --all --existing-auth
open src/main/skills/prototype-usage-receipts/index.html
```

`--existing-auth` only creates temporary symlinks to the CLIs' known auth files. The launcher never reads or prints credentials, deletes its private root on exit and owns every child process it terminates.

## Reproducibility

Inspected application source: `66e90750869893001f2f3bed0d2bcebc5708811c`.

Observed on Node 24.3.0 with:

- Codex CLI 0.154.0.
- OpenCode CLI 1.18.30.
- Repository lockfile OpenCode SDK 1.17.18; this mismatch remains a qualification gate for production parsing.

The probe creates one inert `receipt-probe` Skill in a private temporary root, disables external/project Skill discovery where supported, denies unrelated OpenCode tools and uses harmless deterministic instructions. The committed summary stores only booleans, counts, boundary names and version identifiers.

## Evidence matrix

| Provider path | Observed evidence | Classification |
|---|---|---|
| Codex explicit native Skill input | Public `userMessage` preserves `{type: skill, name}`; private rollout contains one exact `<skill>` context message with assigned name/path/body | Public event E1 Requested; version-qualified private rollout is E2 Loaded, explicit |
| Codex explicit missing file | Native request and completed turn exist; rollout has zero exact body injections | Requested/failed or unknown boundary; not Used |
| Codex automatic prompt | Completed authenticated turn, no native Skill request and zero exact body injections | Unknown/not observed; not Used and not proof of non-use generally |
| Codex restart | Public `thread/read` preserves request but not load receipt; private rollout injection remains after app-server restart | Reconcile E1 publicly and E2 from owned rollout only; deduplicate the same receipt |
| OpenCode verified Skill command | `/command` registry reports `source: skill` and exact template; session history contains the injected body; `command.executed` is live | E2 Loaded, explicit when command snapshot and message/session correlation are exact |
| OpenCode model-selected builtin | Completed trusted `tool === skill` part carries exact metadata and output body; observed live and in history with the provider's available `opencode/big-pickle` model | E2 Loaded; automatic only because the controlled probe submitted no explicit Skill route |
| OpenCode missing command | HTTP 500/session error, no parts or body | Failed request; not Used |
| OpenCode shadowing | Command registry changes to `source: command`; shadow template runs and assigned Skill body is absent | Not Used; name equality is insufficient |
| OpenCode model failure after explicit injection | Assigned body is persisted before a later model error | Skill remains Loaded/Used; task/model outcome is separate |

## Positive boundaries

### Codex explicit

For Codex 0.154.0, a backend parser may emit a positive receipt only from the owned private rollout when all of these match:

1. rollout `session_meta` maps to the registered external thread/application session;
2. a `response_item` user message contains the provider's native `<skill>` envelope;
3. resolved name and canonical path map to the invocation-time assigned Skill;
4. the complete embedded body hashes to the assigned immutable digest;
5. runtime and catalog generation are still valid;
6. the record is new under its provider record identity.

The body and private path are verification inputs, not persisted renderer data. Persist only opaque identity/digest and provider record references. `turn/start` success and the public native Skill item remain E1.

No automatic Codex E2 boundary was observed. Absence of the rollout envelope in this probe means only “not observed under this prompt/version,” not “unused.”

### OpenCode builtin loader

A completed ToolPart is E2 only when the invocation-time registry proves the tool is OpenCode's trusted builtin `skill`, metadata name/directory resolve to the assigned immutable Skill and the returned instruction body hashes completely. Pending/error parts do not prove context entry. A title or look-alike plugin output never qualifies.

Mode is automatic only when a controlled application path proves no explicit Skill request caused the call. Otherwise a valid load can be Used with mode unknown.

### OpenCode explicit command

`command.executed` alone is insufficient. E2 requires a command-resolution snapshot proving `source: skill`, exact assigned template/version, the correlated session/message injection and complete body digest. The probe demonstrated that an ordinary command shadows the Skill and executes without its body.

A later model/provider error does not erase a verified local context injection. A failure before injection is not Used.

## Replay and deduplication

- Codex public history replays the request; the private rollout supplies the stronger receipt. Re-reading the same provider record after restart must not create another use.
- OpenCode session messages replay command-injected bodies and completed builtin ToolParts. Deduplicate live/history by provider session, message, part/call and normalized receipt identity.
- A retry is a new attempt and receives a new receipt even if the Skill and prompt are identical.
- Persist coverage gaps explicitly; history deletion or compaction cannot be converted into a negative claim.

## Remaining gates

1. Qualify and fixture-test the Codex private rollout schema for every supported CLI version; fail closed on format drift. Establish safe incremental tailing and record identity without persisting contents.
2. Align or explicitly qualify the OpenCode SDK/CLI version pair before trusting generated ToolPart contracts.
3. Verify OpenCode builtin failed-load shapes and replay of completed builtin loads across a fresh server using stable provider IDs; the successful no-existing-auth run observed live/history parts, while the existing-auth OpenAI selection later failed for an unrelated redacted model error.
4. Automatic Codex use remains unknown until a positive provider context receipt is observed and attributable. Do not manufacture parity.
5. Integrate receipts before current display projection and before legacy `SkillService.invokeSkill` promotes bridge completion to `loaded`.

## Prototype model

The HTML reducer accepts only exact, version-qualified evidence envelopes. It keeps Requested, Loaded, Failed and Unknown separate; keeps task outcome separate from Skill use; deduplicates replay; rejects wrong-session, partial-body, SDK-mismatch and spoofed-loader evidence; and allows Loaded with unknown invocation mode. The page is a decision aid, not production UI or a provider monitor.
