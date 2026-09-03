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
