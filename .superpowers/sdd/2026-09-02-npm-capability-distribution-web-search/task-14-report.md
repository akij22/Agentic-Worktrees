# Task 14 report — deterministic smoke, documentation, and release readiness

## Implemented

- Added a deterministic local Web Search lifecycle harness over an injected distribution/CLI service seam. It starts without Web Search, consumes local tarball fixture paths, verifies restart persistence, Codex/OpenCode runtime discovery, settings-preserving `0.1.0`→`0.1.1` update, failed-verifier rollback, safe removal/deactivation, offline `migration_pending`, reconnect recovery, and renderer/log redaction.
- Added an owned temporary `npm pack --ignore-scripts` helper; its direct test proves the local tarball exists only during the callback and is removed afterward.
- Isolated opt-in packaged-provider smoke in a temporary Electron user-data directory, captured owned process output before waiting for a window, and made absence of `AW_SMOKE_EXECUTABLE` an explicit successful skip. No login, provider, network, or credential was used.
- Normalized `package:capabilities`, `verify:capability-packages`, and `smoke:capabilities:web-search` npm scripts.
- Strengthened package contract checks with `npm pack --json --dry-run --ignore-scripts` assertions for exact SDK/Web Search `0.1.0` tarball names, docs, licenses, declarations/descriptors, and entries. Temporary non-dry pack output is deleted.
- Replaced obsolete bundled-capability authoring guidance with the installable npm contract, static/runtime parity, self-contained bundle, no lifecycle scripts, trust/arbitrary-code, compatibility, pack inspection, secret handling, and offline test requirements.
- Added the official publishing readiness document. Publishing/signing commands are intentionally omitted; it requires organization ownership, 2FA/trusted provenance, exact versions, clean packs, full verification, offline fallback, secret-manager Ed25519 signing, signed-envelope deployment, and operator authorization.
- Added README Marketplace workflow and exact packaged CLI install/list/update/remove commands.

## Direct verification

- `npm test -- scripts/capability-smoke scripts/package-contract/package-contract.test.ts` — 6 files, 12 tests passed (before adding the owned-pack test).
- `npm test -- scripts/capability-smoke` — 5 files, 10 tests passed, including the subsequently added owned-pack test.
- `npm run package:capabilities` — SDK TypeScript build and self-contained Web Search Vite build passed.
- `npm run verify:capability-packages` — 1 file, 3 package-contract tests passed.
- `npm run build:capability-host` — passed.
- `npm run package` — Electron Forge Darwin arm64 package passed.
- Real-provider smoke — skipped by design because `AW_SMOKE_EXECUTABLE` was not explicitly supplied; no provider/network/credentials were used.
- npm publish/catalog signing/key generation — not run, as required.

## Exact baseline blockers

- `npm run typecheck` reaches only the recorded unrelated `src/renderer/features/coding-agent/views/CodingAgentSession.tsx:387` error: `skillInvocations` is not declared by `Props`.
- `npm run lint` is blocked before linting by duplicate inherited `eslint-plugin-import` resolution between this worktree and its parent checkout.
- `npm test` — 163 files passed, 2 files failed; 1160 tests passed, 26 failed. Failures are the existing Marketplace-service bootstrap mismatch: 3 in `src/main-lifecycle.test.ts` and all 23 in `src/main/ipc/github-auth-handlers.test.ts` (`Marketplace service is unavailable`).

## Fix round 1

- Replaced the pre-programmed lifecycle mock with an independent disk-backed distribution service. Local artifact metadata drives installed versions and verifier behavior; settings, active provider sessions, removal, restart persistence, migration state, picker state, and redacted renderer/log output are read from mutable persisted state.
- Added negative controls proving a no-op update and a verifier that mutates state both fail the lifecycle assertions.
- Wired the deterministic lifecycle into `smoke:capabilities:web-search`; it runs before the optional packaged-provider phase. Missing and unknown `--scenario` values now fail with a nonzero exit instead of silently skipping.
- Removed the unused `readPackedManifest` helper.
- Verification: capability smoke 5 files/14 tests passed; package contracts 1 file/3 tests passed; `package:capabilities` passed; direct Web Search smoke passed its deterministic lifecycle and explicitly skipped the real provider because no executable was supplied. Unknown-scenario CLI exited nonzero.

## Fix round 2

- Made renderer and process-log output injectable into the stateful lifecycle service rather than hardcoding harmless output.
- Added independent lifecycle assertions for leaked managed paths, secret references/tokens, queries, fetched content, and logs, plus a safe-output control.
- Every test-created lifecycle layout now exposes cleanup and removes its temporary directory in `finally`; success and forced-failure tests verify the directory no longer exists.
- Verification: capability smoke 5 files/19 tests passed; package contracts 1 file/3 tests passed; direct Web Search smoke passed locally and explicitly skipped the real provider without an executable.

## Safety

No npm publish, catalog signing, key generation, public network, real provider, credential, or persistent smoke user data was used. Generated package/build output is ignored and is not intended for staging.
