# Task 8 Report — Composed Catalog and Host-only Managed Loading

## Changes

- Removed the production static Web Search imports from both main catalog and Capability Host registry; URL Fetch remains bundled.
- Added `CapabilityCatalog`, deterministic bundled/installed composition, collision detection, and renderer-safe DTO projection.
- Added strict bundled/managed runtime descriptor protocol schemas with 100-entry, unknown-field, and duplicate-ID rejection.
- Converted host initialization and capability updates to runtime descriptors and asynchronous registry loading.
- Added host-only managed imports with canonical containment, static/runtime descriptor identity, tool identity, two digest checks, tamper rejection, and `(id, version, digest)` import caching.
- Injected one composed catalog into main CapabilityService and CapabilityHostManager. Renderer DTOs do not contain runtime descriptors or paths.

## Direct Coverage

Task 8 focused suite: **7 files / 64 tests passed**.

New direct cases cover composed bundled/managed ordering and path-free DTOs; ID/tool collisions; protocol strictness, descriptor count, and duplicates; managed temporary import, unknown bundled ID, path escape, tamper, identity mismatch, and cache identity. Existing server/manager/service suites verify async application, bearer auth, secret declarations, timeout, host ownership/restart behavior, activation semantics, and catalog-driven service behavior.

## Verification

```text
Task 8 focused: 7 files passed; 64 tests passed.
Capability Host build: passed (125 modules; capability-host.js emitted).
Task 7 regression: 7 files passed; 139 tests passed.
Typecheck: changed Task 8 files pass; blocked only by the known unrelated CodingAgentSession.tsx:387 skillInvocations Props diagnostic.
```

## Fix round 1 — readiness, child ownership, bounded settings

- Main startup now awaits composed-catalog refresh before constructing CapabilityHostManager/CapabilityService or registering IPC. Refresh rejection becomes the stable `capability_startup_unavailable` startup state; raw catalog paths/causes are not logged and no window/service/host is created.
- HostManager resolves all initial descriptors before child launch. Update lookup failure stops an already-owned host and kills its child exactly once, preventing orphan utility processes.
- Host protocol settings now enforce JSON-only values, finite numbers, 100 keys/items per level, depth 8, identifier-sized keys, and a 256 KiB serialized limit before host handling.

Direct tests added: startup construction order and refresh-failure recovery, pre-launch unknown descriptor plus existing-host leak regression, and oversized/deep/unsupported settings rejection.

Verification: Task 8 **8 files / 72 tests passed**; Capability Host build passed; Task 7 **7 files / 139 tests passed**; typecheck retains only the known unrelated `CodingAgentSession.tsx:387` blocker.

## Fix round 2 — total post-launch ownership cleanup

`CapabilityHostManager.ensureHost` now wraps every operation after `launch()` in one stable startup boundary: token generation, deferred/record/timer setup, map registration, listener registration, and initialization post. Failure removes a matching partial record, clears its timer, unregisters every listener already attached, and kills the owned child exactly once. Cleanup failures cannot replace or leak into the path-free `internal_error / Capability host failed to start.` result. Existing-host and later `stopHost` calls cannot double-kill.

Direct parameterized regressions inject token generation, partial listener registration, and initialization `postMessage` failures. Each asserts stable errors, one kill, zero message/exit listeners, no retained host (a later stop is a no-op), and no private cause/path exposure.

Verification: Task 8 **8 files / 75 tests passed**; Capability Host build passed; Task 7 **7 files / 139 tests passed**; typecheck retains only the known unrelated `CodingAgentSession.tsx:387` blocker.
