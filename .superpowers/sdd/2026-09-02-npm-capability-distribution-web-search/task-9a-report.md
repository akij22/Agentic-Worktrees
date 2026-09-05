# Task 9A Report — Session/package coordinator primitives

## Implementation

- Added CapabilityRepository queries by Capability ID and deterministic active-run enumeration.
- Added immutable session snapshots, transactional multi-run version changes, and exact association/status/version restoration.
- Added typed `CapabilitySessionPackageCoordinator` and implemented it in CapabilityService using existing host/provider activation boundaries.
- Added active-run count, all-runs-idle gate, reload/restore, transactional deactivate/reactivate, and managed-source validation.
- Package deactivation remembers exactly which sessions were active; reactivation cannot auto-activate unrelated inactive chat associations. Bundled URL Fetch is rejected as a removable managed package.
- Multi-run reload changes persisted versions only after every host/provider succeeds and restores already reloaded providers on failure.

## Direct tests

Real in-memory SQLite tests cover active/inactive association enumeration, immutable exact snapshots, transactional version rollback when a requested association is missing, and exact restoration.

Service tests with injected fake hosts/providers/activator cover active counts, idle rejection, bundled-package rejection, deactivate/reactivate count changes with association preservation, and second-run reload failure with provider rollback and unchanged session records.

## Verification

```text
Focused repository + service: 2 files / 17 tests passed.
Task 8 plus repository regression: 9 files / 91 tests passed.
Task 7 regression: 7 files / 142 tests passed.
Typecheck: changed Task 9A files pass; only the known unrelated CodingAgentSession.tsx:387 skillInvocations Props diagnostic remains.
```
