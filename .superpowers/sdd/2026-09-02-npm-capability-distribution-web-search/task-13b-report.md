# Task 13B report — authenticated forwarding and headless bootstrap

## Implemented

- Added a strict schema-version-1 NDJSON protocol with typed request, review, review-response, progress, result, and safe-error frames; strict schemas; fragmented decoding; and a 1 MiB line bound.
- Added authenticated, random one-use local reply endpoints using 32-byte tokens and request IDs. Unix socket paths are random beneath the Electron temp directory and are removed before/after use; Windows uses named pipes.
- Added primary/secondary coordination with forwarding-data validation before connection, token authentication, interactive review forwarding, progress/result streaming, one-use connection handling, and disconnect-driven cancellation.
- Extracted application service construction and mode bootstrap. CLI mode obtains the single-instance lock before readiness, initializes only package/capability distribution services, executes without BrowserWindow/GitHub/IPC/agent discovery, stops, and quits. UI mode preserves reconciliation, GitHub initialization, discovery, renderer creation, activation behavior, and queues early second-instance requests until services exist.
- Added an explicit database user-data-path seam so headless bootstrap does not depend on ambient Electron path lookup.
- Packaged executable argument normalization distinguishes development and packaged invocation.

## Direct tests

- Protocol: fragmentation, strict malformed/unknown-field rejection, 1 MiB bound, incomplete frame rejection.
- Coordinator: authenticated progress/review/result round trip, malformed additional-data rejection, disconnect cancellation.
- Bootstrap: CLI/UI initialization separation and no CLI BrowserWindow/GitHub/agent initialization.

## Verification

- `npm test -- src/main/cli src/main/application-bootstrap.test.ts` — 6 files, 40 tests passed.
- `npm run package` — passed; Darwin arm64 application packaged.
- `npm run typecheck` — reaches only the recorded unrelated `CodingAgentSession.tsx:387` `skillInvocations` Props blocker.
- `npm run lint` — blocked by the recorded duplicate inherited `eslint-plugin-import` installation/configuration.
- `git diff --check` — passed.
- Packaged `list` was not invoked because it could run startup migration/catalog acquisition against the real user-data directory, conflicting with the no-network/no-user-state constraint.
