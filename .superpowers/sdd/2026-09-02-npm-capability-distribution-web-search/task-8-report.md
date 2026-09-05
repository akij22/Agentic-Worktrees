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
