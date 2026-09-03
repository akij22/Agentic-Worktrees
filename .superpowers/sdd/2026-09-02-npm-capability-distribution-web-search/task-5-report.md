# Task 5 Report — Signed Official Capability Catalog

## Status

Implemented and verified. No production envelope or private key was created.

## Files and rationale

- `catalog/official-capabilities.payload.json` — unsigned release payload containing the exact first Web Search Official entry.
- `src/main/packages/catalog/official-catalog.fallback.json` — trusted built-in fallback snapshot matching the release payload.
- `src/main/packages/catalog/official-catalog.ts` — typed catalog service, exact-byte Ed25519 verification before payload parsing, strict snapshot/descriptor/identity validation, rollback protection, bounded fetch, and atomic valid-cache replacement.
- `src/main/packages/catalog/official-catalog.test.ts` — generated-key tests for valid remote loading, signature/key failures, expiry, schema mismatch, duplicate IDs, identity mismatch, blocked release, rollback, and cache preservation.
- `scripts/catalog/sign-official-catalog.ts` — release-only exact-byte signer; CLI reads the private key only from `AGENTIC_WORKTREES_CATALOG_PRIVATE_KEY` and writes an envelope without logging key material.
- `scripts/catalog/sign-official-catalog.test.ts` — verifies exact payload-byte preservation, Ed25519 signature validity, and absence of private key text from output.
- `package.json` — adds `catalog:sign`.

## TDD evidence

### RED

Command:

```text
npm test -- src/main/packages/catalog/official-catalog.test.ts scripts/catalog/sign-official-catalog.test.ts
```

Result: failed as expected before implementation. Both suites could not import the missing `official-catalog` / `sign-official-catalog` modules; 2 failed suites, 0 tests collected.

### GREEN

Command:

```text
npm test -- src/main/packages/catalog/official-catalog.test.ts scripts/catalog/sign-official-catalog.test.ts
```

Result: PASS — 2 test files, 5 tests.

Command:

```text
npm run typecheck
```

Result: Task 5 files typecheck successfully. The command remains non-zero solely because of the pre-existing unrelated renderer error at `src/renderer/features/coding-agent/views/CodingAgentSession.tsx:387`: `skillInvocations` is not a property of `Props`. Per the task brief, this was not changed.

Command:

```text
git diff --check
```

Result: PASS (no whitespace errors).

## Self-review

- Signature verification uses `verify(null, payloadBytes, key, signature)` before JSON parsing.
- Base64url is strict and round-trip checked.
- Remote response is limited to 1 MiB and the entire fetch/read attempt is limited to 5 seconds with abort.
- Envelope and snapshot reject unknown fields, malformed values, unknown keys, expiry, rollback, duplicate IDs/blocked versions, blocked current releases, and descriptor/package/version identity mismatch.
- Static descriptors are validated through the Task 1 SDK validator.
- Invalid remote data never reaches the atomic cache write; a prior valid cache is preferred over fallback.
- The signer preserves exact payload bytes and does not log or serialize private key material.
- No production signed envelope was generated.

## Concerns

- Production public keys intentionally remain unconfigured in this task because no authorized production public key was supplied. The default service therefore safely uses the embedded fallback until release configuration injects an approved public key.
- The known unrelated renderer typecheck error remains unchanged.
