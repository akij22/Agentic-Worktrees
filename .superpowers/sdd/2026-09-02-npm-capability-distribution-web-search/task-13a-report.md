# Task 13A report — CLI grammar, terminal UI, shared command runner

## Implemented

- Added a strict `install`, `list`, `update`, and `remove` parser with a usage-safe typed error.
- Added a Node terminal adapter with line sanitization, EOF/empty-input rejection, progress labels, and delegated exit codes.
- Added `runPackageCommand` using only `CapabilityDistributionService` lifecycle APIs.
- Install/update review shows exact package/version, trust/review, compatibility, permissions, release notes, and the Community arbitrary-Node-code warning.
- Confirmation rejection performs no mutation; accepted requests preserve exact inspected tuples and active-run counts.
- Progress subscriptions are always removed. Errors are mapped to stable messages; cancellation exits 130.
- No activation, renderer, or BrowserWindow behavior was added.

## Verification

- `npm test -- src/main/cli` — 3 files, 30 tests passed.
- Task 7–12 focused regression command — 13 files, 194 tests passed.
- `npm run typecheck` — blocked only by the pre-existing `CodingAgentSession.tsx:387` `skillInvocations` prop mismatch recorded in the baseline ledger.
- `git diff --check` — passed.
