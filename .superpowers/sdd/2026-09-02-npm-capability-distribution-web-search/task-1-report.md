# Task 1 Implementation Report

## Status

Implemented and committed.

**Commit:** `cfee363` (`feat(capability-sdk): publish static descriptor contract`)

## Changed Files and Rationale

- `.gitignore` — ignores generated `dist/` directories for publishable package and capability workspaces so local builds do not enter source control.
- `package.json` — adds `build:capability-packages`, building the SDK before other workspace packages.
- `package-lock.json` — synchronizes the SDK workspace's Ajv dependency range to `^8.20.0`.
- `packages/capability-sdk/package.json` — replaces source-only workspace exports with public ESM/declaration exports, publish files, public publish configuration, and build/prepack scripts.
- `packages/capability-sdk/tsconfig.build.json` — adds the declaration-producing SDK build configuration and excludes tests from published output.
- `packages/capability-sdk/README.md` — documents public authoring imports, static descriptors, runtime parity validation, and the non-sandbox trust boundary.
- `packages/capability-sdk/LICENSE` — adds the MIT license for the publishable SDK.
- `packages/capability-sdk/src/types.ts` — adds `CapabilityStaticTool` and `CapabilityStaticDescriptor` public contracts.
- `packages/capability-sdk/src/schema.ts` — adds bounded unknown-value validation for manifests and static descriptors, exact-key checks, nested setting/permission validation, JSON Schema compilation, duplicate/tool-count guards, immutable cloned descriptor output, and executable-to-static projection. `validateCapabilityDefinition()` now uses the shared static validation path.
- `packages/capability-sdk/src/schema.test.ts` — covers valid static descriptors, frozen results, null/unknown input safety, unknown keys, invalid names, duplicate names, tool count, and executable projection.

`packages/capability-sdk/src/index.ts` required no textual change because its existing wildcard exports already expose the new types and validator functions.

## Verification

Commands executed exactly:

```bash
npm install
npm test -- packages/capability-sdk/src/schema.test.ts packages/capability-sdk/src/output.test.ts
npm run build --workspace @agentic-worktrees/capability-sdk
npm run typecheck
```

Outcomes:

- `npm install` — completed successfully; updated the lockfile. npm reported 49 dependency audit findings (3 low, 8 moderate, 37 high, 1 critical).
- Focused Vitest command — passed: 2 test files, 8 tests.
- SDK workspace build — passed; TypeScript emitted ESM JavaScript, declarations, declaration maps, and source maps under the ignored `packages/capability-sdk/dist/` directory.
- Root typecheck — failed on a pre-existing unrelated renderer mismatch:

```text
src/renderer/features/coding-agent/views/CodingAgentSession.tsx(387,13): error TS2322:
Property 'skillInvocations' does not exist on type 'IntrinsicAttributes & Props'.
```

No Task 1 SDK type error was reported before the unrelated blocker.

## Self-Review

- Confirmed public package metadata points only to generated `dist` artifacts and includes README/LICENSE in the publish allowlist.
- Confirmed static validation receives `unknown` and performs object/array guards before nested property reads, avoiding raw `TypeError` failures for malformed input.
- Confirmed descriptor output is a structured clone and recursively frozen, preventing mutation of approved manifest, tool, and input-schema metadata.
- Confirmed executable definitions and static descriptors share the same manifest/tool validation path.
- Confirmed duplicate network permissions, duplicate tool names, malformed JSON Schemas, undeclared secret settings, unknown keys, and descriptors over 100 tools are rejected with stable `CapabilityError` codes.
- Confirmed the generated SDK output is ignored and was not committed.

## Concerns

1. The repository-wide typecheck is not green because of the pre-existing `skillInvocations` renderer prop mismatch above; this was intentionally not modified because it is outside Task 1.
2. The initial explicit RED test invocation was not captured before implementation, so the final evidence proves passing behavior but does not preserve the requested failing-test transcript.
3. `npm install` reports 49 existing audit findings, including one critical finding; dependency remediation was outside this task.
4. The root `build:capability-packages` script may build the SDK a second time through the subsequent all-workspaces invocation. This is harmless but could be tightened when the Web Search workspace build is added in Task 2.

---

## Fix Round 1

### Status

Implemented the Important review findings for Task 1.

### Changes

- Added recursive pure-JSON validation for tool input schemas before Ajv compilation or cloning. Validation accepts only plain objects, arrays, finite numbers, strings, booleans, and null; it rejects unsupported values, non-plain instances, and cycles with `CapabilityError("invalid_input", ...)`.
- Changed `validateCapabilityManifest()` to return a detached, recursively frozen clone instead of the caller-owned object.
- Expanded static descriptor tests for invalid JSON Schema, duplicate network permissions, undeclared secret settings, non-JSON values, normalized error codes, detached clones, and recursive immutability.

### RED Verification

```bash
npm test -- packages/capability-sdk/src/schema.test.ts
```

Result: failed as expected: 1 of 8 tests failed because `validateCapabilityManifest()` returned the original mutable object.

### GREEN Verification

```bash
npm test -- packages/capability-sdk/src/schema.test.ts
npm run build --workspace @agentic-worktrees/capability-sdk
```

Results:

- Focused Vitest: passed, 1 file and 8 tests.
- SDK build: passed; TypeScript emitted the ignored publish artifacts under `packages/capability-sdk/dist/`.

### Concerns

- Repository-wide typecheck was not requested for this fix round and remains subject to the unrelated renderer `skillInvocations` mismatch recorded above.
- No Task 2 files were modified during this fix round.
