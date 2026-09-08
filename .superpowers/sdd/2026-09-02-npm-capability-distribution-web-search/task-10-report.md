# Task 10 Report — Bundled Web Search npm migration

## Status

**COMPLETE.** Existing exact reviewed bundled Web Search installations are reconciled through the normal managed-package lock, acquisition, static inspection, executable verification, and atomic installer path. Fresh databases are not populated.

## Changes

- Added frozen `WEB_SEARCH_MIGRATION` identity, descriptor, and canonical permission digest derived from the reviewed Official fallback entry.
- Added `WebSearchMigration.reconcile()` and `retry()` with durable `migration_pending` fallback for offline, static identity, permission, and verification failures.
- Added an installer migration mode that preserves the existing capability installation and settings rows rather than initializing configuration. Secret values are never requested; encrypted references remain opaque.
- Wired migration after composed catalog construction/refresh and before host/service construction and capability session reconciliation.
- Added distribution-service reconciliation/retry facades for the later marketplace connectivity hook.

## Direct tests

1. Exact Official success uses verification/installer without a duplicate consent workflow.
2. Capability installation/settings (including encrypted secret reference) and active session association snapshots remain exactly equal.
3. Offline acquisition creates durable `migration_pending`, no active managed version, no install, and no session loss.
4. Changed accepted permission digest becomes pending before download and retains the prior digest for normal review.
5. Fresh database returns `not_needed` and creates no package record.
6. Static descriptor mismatch becomes pending before commit.
7. Pending retry succeeds once and subsequent retries are idempotent.
8. Real installer migration mode preserves the complete legacy configuration snapshot.
9. Main lifecycle test records startup order `refresh -> migration -> host -> service -> reconcile`.

## Verification

- Direct migration/installer/startup: **3 files / 44 tests passed**.
- Focused migration/installer/startup/service/repositories: **7 files / 111 tests passed**.
- Capability/package Task 7–9 regression selection: **32 files / 392 tests passed**.
- `npm run typecheck`: changed Task 10 files typecheck; command remains blocked only by the known unrelated renderer diagnostic at `CodingAgentSession.tsx:387` (`skillInvocations` missing from `Props`).

## Fix round 1

- Official catalog descriptor drift is now directly rejected before acquisition, static inspection, executable verification, or installation; exact legacy configuration/digest/session snapshots remain unchanged.
- Inspector permission-digest drift now has direct durable-pending coverage with no verification/installation and exact legacy preservation.
- Existing managed records in non-installed/non-pending states are normalized through `saveMigrationPending()`, clearing active metadata and unsafe prior errors while preserving all legacy rows.
- Focused migration suite: **1 file / 8 tests passed**. Capability/package regressions: **32 files / 392 tests passed**. Typecheck retains only the known unrelated renderer blocker.
