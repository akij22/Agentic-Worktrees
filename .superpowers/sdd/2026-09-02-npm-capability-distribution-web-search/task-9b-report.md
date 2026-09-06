# Task 9B1 — Explicit updates and durable recovery

Status: **UPDATE GATE COMPLETE under the approved cooperative-writer guarantee.** Remove is deferred to its next subgate and is not implemented here. Discovery remains based on approved commit `654b6c7`; no approved Task 7/8 commit was rewritten.

## Approved safety boundary

The orchestrator explicitly selected atomic `rename` under the shared `PackageLock`, rather than hard-link/no-clobber publication with a missing-pointer window. Transactional pointer guarantees apply to writers cooperating with that lock. Compare-before-write checks detect observed foreign pointer/configuration changes and retain recovery state rather than knowingly overwriting them. **An uncooperative filesystem writer can still replace a pointer between the last comparison and rename; Node does not provide filesystem compare-and-swap.** No claim of protection against that final non-cooperative race is made.

## Implementation

Inspection defaults to install and accepts explicit `intent: "update"`. Update inspection bypasses fresh-install collision refusal only for the same installed package/capability identity. It acquires a new consent lease, statically reads the acquired descriptor, calculates permission/setup changes, includes release notes and active-run count, and binds acceptance to exact package/version/integrity/permission metadata. Downgrades additionally require an exact version source and explicit acceptance.

Updates preserve compatible ordinary values and opaque encrypted-secret references, apply candidate defaults and deactivate existing runs when setup becomes required. Old executable directories remain retained. Pointer/configuration/managed installation/catalog publication precedes all active-run host/provider reloads. Failure restores persistent state and requests restoration of affected runtimes; conflicts retain a durable SQLite journal and block new activation. Successful deactivation never automatically reactivates the capability.

The journal is written before mutation and stores validated package metadata, relative structured pointers, prior configuration/reference metadata, session associations/version/status, owner token and stable recovery stage/error. It stores no executable root, absolute entry, raw exception or decrypted secret. Startup quarantines incomplete updates before constructing catalogs/hosts. It deliberately does not guess at interrupted provider state or autoactivate sessions: journal snapshots and both versions remain available for explicit update recovery. Cleanup failures remain `cleanup_pending`; retry runs under the same PackageLock, preserves currently referenced secrets, and atomically clears cleanup quarantine only for matching committed metadata. Successful explicit updates may supersede older quarantined attempts without prematurely dropping their snapshots.

Activation also checks SQLite quarantine/journal state, so a stale unblocked catalog cannot bypass recovery blocking. Runtime reloads use the coordinator operation guard and recheck session identity around asynchronous host/provider work. Publication rechecks reviewed installation/configuration, current sessions and idle state.

## Modified files

- `src/shared/packages/schemas.ts`: default install/explicit update inspection contract and update review metadata.
- `src/shared/packages/update-recovery.ts`: strict serializable recovery schema, pointer containment syntax, ownership/identity/metadata validation and stable error stages.
- `src/shared/db/schema.ts`: SQLite recovery table definition.
- `src/main/database/bootstrap.ts`: recovery table for bootstrap/legacy upgrades.
- `src/main/database/index.ts`: startup quarantine before catalog/host construction.
- `src/main/database/index.test.ts`: bootstrap assertion includes the recovery table.
- `src/main/database/migrations/0010_boring_timeslip.sql`: generated recovery table migration.
- `src/main/database/migrations/0011_workable_prowler.sql`: generated removal of the provisional package uniqueness constraint so successful explicit recovery can supersede retained failed attempts.
- `src/main/database/migrations/meta/0010_snapshot.json`, `meta/0011_snapshot.json`, `meta/_journal.json`: generated Drizzle snapshots and migration ledger. Both migrations were produced by `npm run db:generate`, never edited manually.
- `src/main/packages/package-repository.ts`: update installation commits; transactional recovery creation, owner-checked transitions/finalization, quarantine and matching cleanup completion.
- `src/main/packages/package-update-recovery.test.ts`: seven direct journal tests, including real SQLite close/reopen, reference retention, ownership refusal, unsafe relative-path refusal and duplicate in-flight ownership.
- `src/main/packages/npm-acquirer.ts`: acquired release-note metadata projection.
- `src/main/packages/npm-acquirer.test.ts`: metadata projection coverage.
- `src/main/capabilities/capability-distribution-service.ts`: intent-bound inspection/update orchestration, exact consent, setup/default planning, publication/session guards, rollback, journal lifecycle, cleanup retry/recovery and frozen stack-free coded update errors.
- `src/main/capabilities/capability-package-installer.ts`: update commit/restore, prior/current snapshots, atomic pointer publication/restoration, comparison guards, journal preparation and restored-state verification before journal deletion.
- `src/main/capabilities/capability-package-installer.test.ts`: direct update/rollback/catalog/retention and external-pointer boundary tests alongside existing installation regressions.
- `src/main/capabilities/capability-update-configuration.ts`: compatible setting/default/secret-reference planning without decryption.
- `src/main/capabilities/capability-update-configuration.test.ts`: eight direct configuration cases.
- `src/main/capabilities/capability-repository.ts`: authoritative SQLite activation blocking for quarantined/in-flight packages.
- `src/main/capabilities/capability-service.ts`: blocked activation guard, serialized reload/session checks and deactivation finalization.
- `src/main/capabilities/capability-service.test.ts`: activation/coordinator regression coverage.
- `src/main/capabilities/capability-session-package-coordinator.ts`: explicit finalization contract for successful deactivation.
- `src/main/capabilities/catalog.ts`: blocked catalog/DTO projection.
- `src/main/capabilities/installed-catalog.ts`: visible signed-policy blocked installations.
- `src/main/capabilities/capability-block-policy.test.ts`: direct signed active-version blocking visibility case.
- `src/main/capabilities/capability-update-lifecycle.test.ts`: 28 direct lifecycle cases using SQLite, temporary executable layouts, fakes and deterministic barriers. Includes a real CapabilityService coordinator with first-provider success followed by second-provider failure and assertions for restored first/second runtimes, host settings, pointer, managed row, configuration, catalog, associations and old executable retention.
- This report and `progress.md`: final scope, approved limitation and exact verification evidence.

## Direct lifecycle cases: 28

1. Omitted intent defaults to install; explicit update survives parsing.
2. Fresh-install collision remains refused.
3. Static review metadata is published while consent is held.
4. Install acceptance cannot consume an update lease.
5–8. Consent binds accepted package name, version, integrity and permission digest independently.
9. Unaccepted exact downgrade is refused.
10. Explicitly accepted exact downgrade succeeds.
11. Changed active-run consent is refused before pointer swap.
12. Busy runs prevent persistent mutation.
13. Compatible settings survive; all active associations reload without activating new chats.
14. Missing required setup deactivates without automatic reactivation.
15. Coordinator-rejection rollback restores persistent state and requests runtime restoration.
16. External configuration changes during pending reload are preserved.
17. Obsolete references remain until provider work completes.
18. Another inspection waits behind provider work on the same global lock.
19. Real SQLite restart quarantines an unfinalized commit before activation, even with a stale catalog.
20. Session changes during publication idle checking are preserved and quarantined.
21. A turn beginning during preparation prevents publication.
22. Failed runtime rollback retains a durable conflict snapshot and both versions.
23. Explicit update can recover a quarantined package without prematurely dropping its prior journal.
24. Real coordinator restores the first successful provider after second-provider failure, including runtime settings/catalog/pointer/DB.
25. Failed encrypted-reference cleanup is journaled and retried; success restores installed usability without activation.
26. Public update failures are immutable, coded and stack/path-free.
27. Precommit failure with a foreign pointer retains its recovery journal and does not overwrite that pointer.
28. Update progress events are frozen, schema-valid and path-free.

## TDD evidence witnessed

- Installer pointer regression: RED **1 failed / 32 passed / 33 total** before comparison guards; then GREEN.
- New journal API: RED **7 failed / 7 total** because recovery methods did not exist; then GREEN.
- Immutable public error regression: RED **1 failed / 26 passed / 27 total**; then GREEN after public-boundary freezing/stack removal.
- Foreign-pointer precommit journal regression: RED **1 failed / 27 passed / 28 total**; then GREEN after verifying restored state before deleting the journal.
- The first 19 lifecycle cases were inherited from the interrupted worktree; their original RED execution was not witnessed in this resumed session. They were rerun repeatedly and are not counted as new discovery cases.

## Final verification

- Broad capability/package/shared-package/database selection: **32 files / 365 tests passed**.
- Focused Task 9 selection: **7 files / 114 tests passed** — lifecycle 28, recovery journal 7, configuration 8, block policy 1, installer 33, discovery 10, metadata 27. Installer totals include earlier install regressions; discovery remains exactly 37 tests and is separate from the lifecycle gate.
- Task 7 selection (installer, installed catalog, distribution, consent lease, PackageLock, capability repository, package repository): **7 files / 149 tests passed**.
- Task 8 + repository selection (main lifecycle, catalog, host protocol/registry/server/manager, capability service, installed catalog, capability repository): **9 files / 100 tests passed**.
- `npm run typecheck`: only known unrelated `CodingAgentSession.tsx:387` missing `skillInvocations` Props diagnostic.
- Local-config ESLint over every modified/new TypeScript file: **0 errors / 13 warnings**.
- `git diff --check`: passed.
- No renderer change, frontend build, remove implementation, package publication or destructive Git operation. Graphify artifacts are absent in this worktree; read-only scouts assisted the audits.

## Remaining scope and limitations

Remove/GC is a separate gate. Old executable versions are deliberately retained rather than garbage-collected here. Interrupted provider transactions are quarantined for explicit recovery, not replayed automatically at startup. Cleanup retries do not activate sessions. The cooperative-writer boundary above is an explicit accepted design limitation, not an outstanding implementation claim. The known renderer typecheck blocker remains outside this task.
