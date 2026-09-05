# Task 9B — Partial implementation: metadata-only update discovery

Status: **BLOCKED / NOT COMPLETE**. This commit implements the discovery prerequisite selected by the orchestrator, not the requested update/remove lifecycle. No claim of satisfying the 25 direct lifecycle-test gate is made.

## Decisions received

- Inspection must gain explicit `intent: install | update`, defaulting to install compatibly. Only update inspection opens the consent lease consumed by update. This remains to implement.
- `checkForUpdates` is metadata-only discovery: npm packuments, no archives/staging/verifier/lease. Permission changes/setup are unknown until static manifest inspection. Implemented here.

## Modified files

- `src/main/packages/npm-metadata.ts`: registry-only, bounded 1 MiB packument adapter with a 5-second deadline, redirect refusal, strict package/version identity and canonical SHA-512 integrity checks. Resolves tags/exact versions/ranges using existing npm-package-arg/semver dependencies. Returns frozen metadata with optional explicit release notes; no archive/download URL or raw error causes are exposed.
- `src/main/packages/npm-metadata.test.ts`: 27 direct injected-fetch tests, including timeout barriers/fake clock, bounded bodies, identity/source/integrity failures, exact/range/tag resolution, omission of invented notes, redaction and immutability. No network is used.
- `src/main/capabilities/capability-distribution-service.ts`: metadata adapter injection and pure `checkForUpdates(packageName?)`; uses original package identity, signed Official release identity/notes/blocklist, and current active-run count. No operation rows, consent lease, archive acquisition, verification, installation or events are produced.
- `src/main/capabilities/capability-update-discovery.test.ts`: 10 direct real in-memory SQLite discovery tests. Assert no DB changes/lease/acquisition/verifier/install/events, indeterminate permission/setup fields, frozen schema-valid DTOs, current-version/downgrade filtering, Official identity and blocked-candidate refusal, safe failures.
- `src/shared/packages/schemas.ts`: discovery release notes, permissionChanged and requiresSetup are optional; requiresReview marks inspection still required. Missing means unknown, not false. Existing DTO callers with booleans remain accepted.
- This report and `progress.md`: record exact completed/remaining scope and test evidence.

## TDD and verification

RED: metadata suite failed to import the absent adapter; discovery suite had 10 failing tests because checkForUpdates did not exist. During implementation tests also caught bare npm specs resolving as ranges rather than the latest tag, and undefined releaseNotes being emitted as a property instead of omitted.

GREEN:
- New discovery prerequisite: 2 files / 37 tests passed.
- Task 9 current lifecycle/repositories plus new discovery suites: 7 files / 129 tests passed.
- Task 7 regression: 7 files / 143 tests passed.
- Task 8 + repository regression: 9 files / 99 tests passed.
- Typecheck: only known `CodingAgentSession.tsx:387` missing skillInvocations Props diagnostic.

## Exact remaining completion blockers

1. Explicit inspection intent, distinct install/update collision policy and intent-bound exact acceptance tuple.
2. Transactional commitUpdate/restoreUpdate/remove/restoreRemoval and old-version retention/GC.
3. Compatible settings and encrypted-reference planning, defaults, needs_setup/no-autoactivation and post-success obsolete-reference cleanup.
4. Update/remove orchestration under the single consent PackageLock, accepted active count/idle checks, multi-run rollback, pending snapshot finalization/recovery.
5. Blocked active-package visibility and activation refusal, while preserving allowed update/remove recovery.
6. At least 25 readable **lifecycle** tests using temp layouts, SQLite and deterministic provider/host barriers. The 37 new discovery tests do not substitute for these.

No renderer, schema migration, network execution or subagents. Existing install behavior was not changed; update/remove entry points have not been exposed prematurely.

Scoped local-config ESLint: 0 errors / 2 existing warnings (unused service stub parameter and schema import). `git diff --check` passed.
