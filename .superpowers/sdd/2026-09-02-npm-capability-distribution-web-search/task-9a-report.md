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

## Review fix — snapshot ordering, rollback, serialization, immutable time

- `deactivateRuns` now completes the all-runs idle gate before creating/storing its rollback snapshot. Every pre-snapshot rejection clears attempt-local state, so `reactivateRuns` cannot act on an unperformed deactivation.
- Reactivation tracks successfully restored runs. If a later host/provider fails, those runs are deactivated through the existing rollback boundary before exact SQLite restoration, keeping provider/host and DB state aligned.
- Deactivate/reactivate coordination uses a per-Capability operation token; concurrent calls fail deterministically before snapshot mutation or host/DB interleaving.
- Session snapshots expose numeric timestamp primitives rather than mutable `Date` objects, and freeze each record and records array.

Direct additions cover idle rejection followed by forbidden reactivate, concurrent deactivate/reactivate exclusion, second-run reactivation failure with provider rollback and exact inactive DB restoration, and timestamp/record mutation rejection.

Verification: focused Task 9A **2 files / 19 tests passed**; Task 8+repository **9 files / 93 tests passed**; Task 7 **7 files / 142 tests passed**; typecheck retains only the known unrelated `CodingAgentSession.tsx:387` blocker.

## Remaining review fix — revision-bound deactivation snapshots

Coordinator deactivation state now stores an opaque UUID token, monotonic service revision, and immutable repository snapshot. A second deactivation cannot overwrite a pending snapshot. Reactivation requires the same token/revision and verifies the complete current association set still matches the expected post-deactivation IDs, versions, and statuses before and after the asynchronous idle gate. Stale state fails closed with a stable activation error before host/provider work; the stale snapshot is neither restored nor deleted. Conditional cleanup/deletion also checks token and revision.

Direct deterministic coverage externally changes the inactive session version between deactivation and reactivation, then asserts rejection, preservation of the external state, and zero reactivation host/provider calls. Existing concurrency coverage proves overlapping deactivate/reactivate cannot replace the revision-bound snapshot.

Verification: focused Task 9A **2 files / 20 tests passed**; Task 8+repository **9 files / 94 tests passed**; Task 7 **7 files / 142 tests passed**; typecheck retains only the known unrelated `CodingAgentSession.tsx:387` blocker.
