# Task 11 Report — Narrow Marketplace IPC and live catalog events

## Result

Implemented the typed, path-free `marketplace:*` IPC surface, including the Task 9B2 `inspectRemoval` review contract. Local Skill, Capability, and Marketplace handlers no longer depend on GitHub authentication.

## Changes

- Centralized ten dedicated Marketplace channels and added typed `Api.marketplace` methods.
- Added Zod-validated Marketplace handlers for list, inspect, install, update discovery/update, removal inspection/removal, cancellation, migration retry, and progress events.
- Added preload response/event validation and exact-listener unsubscribe behavior.
- Replaced Capability events with the strict session/catalog discriminated union and routed catalog refresh globally while retaining run scoping for session changes.
- Wired one distribution service at startup and added replaceable, duplicate-safe event subscription ownership.
- Validated distribution progress before broadcast and translated successful install/update/remove terminals into validated catalog events.

## Direct TDD coverage

- `src/main/ipc/marketplace-handlers.test.ts`: 4 tests covering malformed/unknown input, all lifecycle mappings, Task 9B2 removal review, outbound DTO validation, and path-free catalogs/events.
- `src/preload.test.ts`: 2 tests covering every Marketplace method/channel and exact unsubscribe with strict event validation.
- `src/main/ipc/marketplace-event-subscription.test.ts`: 1 test covering duplicate startup and replacement cleanup without listener leaks.
- `src/shared/ipc/schemas.test.ts`: strict session/catalog union acceptance and rejection.
- `src/renderer/features/capabilities/hooks/useCapabilities.test.tsx`: global catalog and matching-run session routing plus cleanup.

RED was witnessed when the Marketplace handler module did not exist. GREEN focused verification passed 9 files / 81 tests.

## Verification

- Focused IPC/preload/schema/hook/service: 9 files, 81 tests passed.
- Task 7–10 Capability/package/database regressions: 34 files, 402 tests passed.
- `npm run package`: passed, including main, preload, renderer, host, and verifier Vite builds.
- `npm run typecheck`: reaches only the known unrelated baseline blocker at `src/renderer/features/coding-agent/views/CodingAgentSession.tsx:387` (`skillInvocations` missing from `Props`).
- Scoped ESLint could not start because the inherited worktree and parent installations resolve duplicate `eslint-plugin-import` instances.
- `git diff --check`: passed.

## Fix round 1

- Moved raw request parsing, service invocation, and outbound DTO parsing for every Marketplace operation behind one stable-error boundary. Skill listing and its DTO parsing are now contained by the same boundary; raw service errors, Zod issues, causes, stacks, and paths do not cross IPC.
- Captured Marketplace handlers once during registration rather than resolving mutable services per invocation.
- Removed dynamic Skill-service access from distribution event callbacks, guarded replacement ownership, and isolated malformed/stale callbacks so startup and teardown cannot throw or leak listeners.
- Strengthened direct tests for stable malformed-input/backend/event errors, throwing Skill catalogs, successful preload response/channel/payload mapping, and stale callback isolation.
- Verification repeated: focused 9 files/81 tests and Task 7–10 regressions 34 files/402 tests pass. Typecheck retains only the known unrelated renderer Props blocker; `git diff --check` passes.

## Fix round 2

- Made both subscription replacement edges exception-safe: throwing unsubscribe functions cannot prevent replacement, throwing subscribe functions leave no stale active service, and retries/replacements remain available. Only stable `marketplace_event_*_failed` codes are reported.
- Rewrote preload success coverage so all nine invoke operations use concrete valid requests/responses and assert exact channels, payloads, and parsed return values; subscription delivery/unsubscribe and malformed response rejection remain separate.
- Verification: focused 9 files/84 tests and Task 7–10 regressions 34 files/402 tests pass. Typecheck retains only the known unrelated `CodingAgentSession.tsx:387` Props blocker; `git diff --check` passes.
