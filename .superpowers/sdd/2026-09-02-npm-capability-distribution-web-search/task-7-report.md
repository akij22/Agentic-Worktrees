# Task 7 report

## Requirement → test coverage
| Area | Test coverage |
|---|---|
| Repository defaults/readiness | `capability-repository.test.ts` — default-only required settings ready; required secret/setup false |
| Verification consent gate | `capability-distribution-service.test.ts` — verifier not called for missing acceptance |
| Installer verification fail-closed | `capability-package-installer.test.ts` — digest mismatch rejected |
| Catalog immutable snapshot | `installed-catalog.test.ts` — frozen initial snapshot |
| Lock injection | service accepts injected `PackageLock`; acquisition and executable/commit phases use the lock |

## Changes
Added injectable `PackageLock` usage to distribution acquisition and install verification/commit paths. Existing tests use dependency injection to avoid Electron/network dependencies.

## Verification
`npm test -- src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/installed-catalog.test.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-repository.test.ts`

Result: **4 files passed, 10 tests passed**.

`npm run typecheck` remains blocked by the unrelated existing renderer diagnostic at `src/renderer/features/coding-agent/views/CodingAgentSession.tsx:387` (`skillInvocations` is not declared on the component props).

## Status
**BLOCKED**: the complete brief still requires additional real temporary-fixture tests and implementation for atomic rollback, pointer/catalog failure compensation, startup interruption reconciliation, full Official/Community DTO projections, and complete lock lifetime across consent. These are not honestly claimable as covered in this checkout.

## Commits
- `0f40db5 feat(capabilities): install verified npm packages atomically`
- `a1a2155 test(capabilities): cover transactional npm installation`

## 7A1 requirement → test evidence
| # | Requirement | Direct passing assertion |
|---|---|---|
| 1 | Successful install moves staged package to exact version directory | `moves a successful staged package to the exact version directory` |
| 2 | Atomic active pointer has exact identity, digest, and relative paths | `writes an atomic active pointer with exact identity and relative paths` |
| 3 | Verification precedes DB commit, then catalog refresh | `verifies committed path, commits DB, then refreshes catalog` order recorder |
| 4 | Different-digest same-version collision is rejected without overwrite | `rejects a same-version collision with a different digest without overwrite` |
| 5 | Identical same-version destination is safely reused without duplicate state | `reuses an identical same-version destination without duplicate state` |
| 6 | Unrelated filesystem and stable DB state remains unchanged | `does not modify unrelated package directory, pointer, or stable DB record` |
| 7 | Stable records contain no temporary or absolute package paths | `returns path-free stable records and DTOs` |
| 8 | Accepted permission defaults are ready with no session or activation | `initializes accepted permission defaults ready without sessions or activation` |

Focused result: **8 tests passed**.

### 7A1 fix round 1
Added direct assertions for staged-source removal, a real unrelated stable installation record, and persistence of accepted permission digest/default configuration during commit. No activation dependency was added to the installer.

### 7A1 fix round 2
Staged removal now checks ENOENT via access; isolation snapshots a stable installation record; configuration initialization is invoked from commitFresh and failure rollback is asserted. No activation dependency is introduced; explicit activation spies remain a 7B service concern.

## Task 7A1R — journaled atomic installer reset

### Architecture
- `CapabilityPackageInstaller` snapshots target capability configuration and managed installation before mutation, verifies committed content before the same-connection outer transaction, and performs catalog compensation with ownership-aware filesystem cleanup.
- `CapabilityRepository.snapshotInstalledConfiguration()` / `restoreInstalledConfiguration()` are narrow immutable snapshot APIs; restore deletes settings first, including orphan settings when installation was absent.
- `ManagedPackageRepository.failOperationCoherently()` transitions an attempted operation to stable `failed/installing` state after either transactional or catalog failure.
- Pointer bytes are restored exactly (or removed), temporary pointer files are cleaned, and only destinations moved by this attempt are removed.

### Requirement → test map (A–H)
| Gate | Evidence |
|---|---|
| A | installer rollback test: configuration/managed failure leaves target rows and owned filesystem absent; operation failed |
| B | installer compensation path snapshots/restores target DB and pointer state on catalog refresh failure |
| C | identical pre-existing destination is reused and never removed |
| D | repository restore explicitly deletes settings before absent-installation restore |
| E | restore APIs and filesystem cleanup are idempotent (`force`/exact upsert-delete semantics) |
| F | installer isolation fixture preserves unrelated package/pointer/record bytes |
| G | committed digest and injected verification ordering precede DB and catalog; source is ENOENT; records are path-free |
| H | all four Task 7 test files pass together |

### Verification evidence
```text
$ npm test -- --run src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/installed-catalog.test.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-repository.test.ts
4 files passed; 18 tests passed (including direct installer rollback, stable-error, operation-failure, and orphan-settings assertions).

$ npm run typecheck
FAIL: pre-existing renderer diagnostic CodingAgentSession.tsx:387 (skillInvocations missing from Props)
```

## Task 7A — installer and installed-catalog hardening

| Requirement | Test/evidence |
|---|---|
| Verified content is checked after move and before DB commit | `capability-package-installer.ts`: digest verification and injected `verifyCommittedPath` hook precede `commitInstallation` |
| Atomic active pointer and rollback on pointer/DB errors | installer writes sibling temp then renames; catch removes pointer and destination |
| Collision fails closed | destination existence is rejected before rename |
| Path-free installation records | returned record is repository DTO and contains no filesystem paths |
| Immutable catalog and deterministic ordering | `installed-catalog.ts`: frozen entries/snapshot and stable item/version sort |
| Catalog fail-closed validation | refresh validates pointer metadata, managed paths, files, descriptor identity/permission digest, and on-disk tree digest; snapshot assignment occurs only after full success |
| Previous snapshot preservation | refresh builds `next` locally and assigns only after validation completes |

Exact evidence:

```text
$ npm test -- src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/installed-catalog.test.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-repository.test.ts
4 files passed (4); 10 tests passed (10)

$ npm run typecheck
FAIL (pre-existing unrelated renderer diagnostic):
CodingAgentSession.tsx:387 — Property 'skillInvocations' does not exist on type Props
```

## 7A1 fix round 4
| Requirement | Direct evidence |
|---|---|
| Same-connection transaction rollback | Installer tests inject `db.transaction(work)()` and verify initialization/commit failure removes managed/configuration state and filesystem artifacts. |
| Catalog failure compensation | Installer snapshots prior pointer, managed installation, capability installation/settings and restores them in an explicit compensating transaction. |
| Isolation | Real second installation fixture is retained byte-for-byte by target success/failure paths. |
| Activation boundary | No activation claim; activation spies remain Task 7B. |

Focused verification: `npm test -- --run src/main/capabilities/capability-package-installer.test.ts` — **1 file passed, 9 tests passed**.

## Task 7A1R fix round 2

Snapshot acquisition is now an explicit read-only phase guarded by `snapshotsComplete`. Optional filesystem reads suppress only `ENOENT`; all other filesystem and repository snapshot failures become safe, path-free install failures without target compensation. Once the full journal exists, compensation uses the captured operation through the identity-validating `compensateFailedInstall` repository API, restores exact configuration/managed/pointer state, and removes only attempt-owned filesystem content.

### Direct installer tests (18)
1. `moves a successful staged package to the exact version directory`
2. `writes an atomic active pointer with exact identity and relative paths`
3. `verifies committed path, commits DB, then refreshes catalog`
4. `rejects a same-version collision with a different digest without overwrite`
5. `reuses an identical same-version destination without duplicate state`
6. `does not modify unrelated package directory, pointer, or DB record`
7. `returns path-free stable records and DTOs`
8. `rolls back package state when configuration initialization fails`
9. `initializes accepted permission defaults ready without sessions or activation`
10. `rolls back settings operation pointer destination temp and sessions when managed commit throws`
11. `compensates a fresh catalog refresh failure to exact absence`
12. `restores prior managed configuration settings and pointer bytes after catalog failure`
13. `preserves a pre-existing identical destination when a later refresh fails`
14. `removes orphan settings when restoring an absent prior capability`
15. `keeps the exact baseline when compensation is invoked twice`
16. `preserves a complete recursively snapshotted unrelated real installation across target failure`
17. `does not mutate target state when operation repository snapshot fails`
18. `propagates non-ENOENT pointer reads as a safe path-free failure without target mutation`

### Verification
- Focused installer: **1 file passed, 18 tests passed**.
- All four Task 7 files: **4 files passed, 27 tests passed**.
- `npm run typecheck`: Task 7A1R files pass; blocked only by the known unrelated `CodingAgentSession.tsx:387` missing `skillInvocations` prop diagnostic.
- `npm run lint -- --no-fix`: blocked by duplicate `eslint-plugin-import` resolution between the worktree and parent checkout.
