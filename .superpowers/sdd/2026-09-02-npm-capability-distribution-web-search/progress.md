# SDD ledger — plan: docs/superpowers/plans/2026-09-02-npm-capability-distribution-web-search.md

## Pre-flight consistency scan

| Scope | Producer / consumer check | Finding |
|---|---|---|
| Task 1 | SDK descriptor API and compiled package consumed by Tasks 2, 5, 6, 7 | Interfaces align. Task 1 also needs lockfile consistency and ignored generated dist output although those paths were omitted from its file list. Ruling: allow `.gitignore` and `package-lock.json` only for those two consequences; cost if wrong is two unnecessary scoped changes. |
| Task 2 | Web Search descriptor/package consumed by Tasks 5, 6, 10, 14 | Package identity, Capability ID, tool name, and descriptor parity align. |
| Task 3 | Shared package DTOs and DB records consumed by Tasks 4–13 | Request/response names and state unions align. |
| Task 4 | Staged package/acquisition interfaces consumed by Tasks 6–10 | Staging paths, integrity, digest, lock, and error contracts align. |
| Task 5 | Signed catalog consumed by Tasks 7, 9, 10, 12 | Official identity, descriptor, release notes, block policy, and fallback align. |
| Task 6 | Inspector/verifier outputs consumed by Tasks 7 and 9 | Static-before-code boundary and verification result align. |
| Task 7 | Fresh installer, installed catalog, and distribution service consumed by Tasks 8–13 | Fresh install produces global ready/needs-setup state without chat activation. |
| Task 8 | Composed catalog/runtime descriptors consumed by Tasks 9, 10, 14 | Runtime descriptor remains main-to-host only and Web Search static imports are removed. |
| Task 9 | Update/remove/session coordinator consumed by Tasks 11–14 | Acceptance fields, downgrade rules, active-run count, and rollback align. |
| Task 10 | Migration service consumed by Tasks 11–14 | Runs before session reconciliation and preserves settings/session records. |
| Task 11 | Marketplace IPC/events consumed by Task 12 and catalog refresh hooks | DTO and event names align; local operations remain independent of GitHub auth. |
| Task 12 | Marketplace state/actions consumed by Task 14 smoke | Approved copy, filters, no excluded CTA, and picker refresh align. |
| Task 13 | CLI command mode consumes Tasks 7, 9, 10, 11 service contracts | Commands, confirmation, forwarding, and no-window behavior align. |
| Task 14 | Smoke/release verification consumes all prior outputs | Verification order and guarded external publish align. |
| Shared files Tasks 1/2/4/5/14 | `package.json` and `package-lock.json` changes are cumulative | Each task owns only its declared dependency/script delta; later tasks must preserve earlier scripts. |
| Shared files Tasks 3/9 | package repository and Capability repository extensions are cumulative | Task 9 extends Task 3 transactions without renaming earlier methods. |
| Shared files Tasks 7/8/9/10 | Capability catalog/service/repository integration is cumulative | Task 8 injects catalog; Tasks 9–10 add lifecycle behavior without restoring static Web Search imports. |
| Shared files Tasks 6/13 | `forge.config.ts` gains verifier entry then preserves it during CLI packaging | No conflicting entry names. |
| Shared files Tasks 8/10/11/13 | `src/main.ts` is progressively reduced to bootstrap wiring | Task 13 is the final structural refactor and must retain earlier migration/event ordering. |
| Shared files Tasks 11/12 | Shared schemas/API/preload are consumed by renderer state machine | No renderer-facing path-bearing type is introduced. |

## Baseline

- Worktree: `.worktrees/npm-capability-distribution-web-search`
- Branch: `feat/npm-capability-distribution-web-search`
- Base: `adcaed3`
- `npm ci`: completed; npm reported 49 dependency vulnerabilities already present in the lockfile dependency graph.
- `npm test`: 126 files, 720 tests passed.
- `npm run typecheck`: not clean at baseline/Task 1 boundary because `src/renderer/pages/CodingAgentSession.tsx:387` passes `skillInvocations` to a component type that does not declare it. Task 1 did not modify that area. Ruling: record as pre-existing and do not mix an unrelated renderer fix into Task 1; cost if wrong is deferring a real branch-wide blocker that must be resolved before final acceptance.

## Task progress

- Task 1 implementer: `Worker-fixed`
- Task 1 base: `adcaed3`
- Task 1 candidate head: `cfee363`
- Task 1 review: spec ❌, quality needs fixes — static schemas accept non-JSON values; public manifest validator returns mutable caller object; static-descriptor tests miss three required malformed cases.
- Task 1 minor (deferred): RED-phase transcript was not preserved and cannot be reconstructed honestly.
- Task 1 minor (deferred): root `build:capability-packages` invokes the SDK build twice.
- Task 2 was committed out of order as `594bbd3` while Task 1 review remained open. Ruling: isolate Task 1 fix re-review to `594bbd3..0021359`; Task 2 receives its own full review next. Cost if wrong: an interaction between the Task 1 fix and Task 2 may be deferred to Task 2 or final review.
- Task 1: fix round 1/5 (3 addressed, 0 open; commit `0021359`).
- Task 1: complete (commits `cfee363` and `0021359`, review clean; 2 minors deferred).
- Task 2 minor (deferred): package-contract tarball assertion does not explicitly include `package/README.md`.
- Task 2: complete (commit `594bbd3`, review approved; 1 minor deferred).
- Task 3 review: spec ❌, quality needs fixes — package-name collision can preserve the wrong item identity; inspection DTO has no strict runtime schema.
- Task 3 minor (deferred): DB check allows partially populated active metadata for `migration_pending`.
- Task 3 minor folded into Important regression coverage: inverse package-name collision test was missing.
- Task 3: fix round 1/5 (2 addressed, 0 open; commit `fe9b1d4`).
- Task 3: complete (commits `99abe15` and `fe9b1d4`, review clean; 1 minor deferred).
- Task 4 review: spec ❌, quality needs fixes — stale lock ownership/recovery races, malformed lock leakage, non-portable digest ordering, descriptor/path TOCTOU, and missing live-PID test.
- Task 4 Ruling: do not inject `PackageLock` into `NpmPackageAcquirer`; Task 7 must hold the global lock across acquisition, verification, and atomic commit, otherwise locking acquisition alone leaves the transaction split. Cost if wrong: direct callers of the low-level acquirer are not serialized until Task 7 and must remain internal-only.
- Task 4 minor (deferred): acquisition-level tests do not directly assert every bound/integrity/no-script side effect even though lower-level tests cover them.
- Task 4 minor (deferred): content-digest tests do not clean all temporary directories.
- Task 4: fix round 1/5 (1 addressed, 3 open — lock replacement race, bytewise-order test not discriminating, post-read pathname identity not checked; commit `54e8c1d`).
- Task 4 Ruling: replace the custom stale-file lock protocol with maintained `proper-lockfile`; portable Node has no atomic compare-and-delete primitive, and the first token/quarantine design still displaced a replacement owner. Cost if wrong: one additional runtime dependency and reliance on its lease/heartbeat semantics instead of the plan's `fs.open("wx")` sketch.
- Task 4: fix round 2/5 (2 addressed, 2 open — real heartbeat test absent; compromise path releases local queue while task continues; commit `1872f82`).
- Task 4: fix round 3/5 (1 addressed, 1 open — contender times out before stale threshold, so heartbeat renewal is not proven; commit `b5b2604`).
- Task 4: fix round 4/5 (1 addressed, 0 open; commit `3681a6d`).
- Task 4: complete (commits `560e61d`, `54e8c1d`, `1872f82`, `b5b2604`, `3681a6d`; review clean; 2 minors deferred).
- Task 5 review: spec ❌, quality needs fixes — timed-out/concurrent refresh can commit stale data; signed payload decoding is non-fatal UTF-8; trusted fallback expires at runtime; timestamps accept noncanonical/future values.
- Task 5 minor (deferred): signer test does not directly capture stdout/stderr for key leakage.
- Task 5 minor folded into Important regression coverage: missing malformed UTF-8, future issuance, response bound, timeout/late mutation, post-expiry fallback, and concurrent sequence tests.
- Task 5: fix round 1/5 (4 addressed, 0 open; commit `a357162`).
- Task 5: complete (commits `d19d32a`, `a357162`; review clean; 1 minor deferred).
- Task 6 review: spec ❌, quality needs fixes — inspector trusts staged package JSON, metadata reads are not strictly bounded/race-safe, manifest symlink escape is possible, utility-entry security cases are untested, and synchronous adapter throws delay cleanup.
- Task 6 minor (deferred): verification protocol validates but retains the original unnormalized descriptor object.
- Task 6 minor (deferred): compressed security tests reduce diagnostic clarity.
- Task 6: fix round 1/5 (3 addressed, 2 open — invalid/app compatibility/real Official mismatch tests absent; import redaction test bypasses the actual utility boundary; commit `c17bbae`).
- Task 6: fix round 2/5 (2 addressed, 0 open; commit `3501a08`).
- Task 6: complete (commits `0e94fa2`, `c17bbae`, `3501a08`; review clean; 2 minors deferred).
- Task 7 initial implementation commits: `0f40db5`, `a1a2155`, `c33332a`; implementer BLOCKED because the task remained too broad for complete fixture-level coverage.
- Task 7 Ruling: split remaining work into sequential 7A installer/catalog, 7B consent/lock/distribution, and 7C reconciliation/configuration gates, then run one complete Task 7 review. Cost if wrong: extra commits/reviews and possible overlap between subtask fixtures, but no requirement is deferred.
- Task 7A implementer committed `9d8952a` but remained BLOCKED on real fixture breadth. Ruling: split 7A into 7A1 success/collision fixtures, 7A2 failure compensation fixtures, and 7A3 installed-catalog snapshot fixtures. Cost if wrong: duplicated fixture helpers and additional commits, mitigated by keeping helpers local until patterns stabilize.
- Task 7A1 review: missing staged-source removal assertion, unrelated stable DB record fixture, and consent/no-activation evidence.
- Task 7A1 Ruling: installer tests must prove accepted permission digest/defaults and no session row through `commitFresh`; the explicit activation spy belongs to 7B distribution-service tests because installer has no activation dependency. Cost if wrong: activation regression is caught one micro-gate later rather than in installer isolation.
- Task 7A1: fix round 1/5 (0 fully addressed, 3 open — directory read produced false ENOENT proof; unrelated tree snapshot incomplete; configuration initialized before commitFresh; commit `4cf4971`).
- Task 7A1: fix round 2/5 (staged removal/session assertions addressed; 4 open — fake unrelated fixture, separate DB transactions, incomplete compensation assertion, stale report; commit `4686876`).
- Task 7A1: fix round 3/5 (mandatory coordinator added; still open — tests use no-op transaction, catalog post-commit DB compensation absent, realistic unrelated full snapshot/report/all-suite absent; commit `608851d`).
- Task 7A1 Ruling after technical review: reject reviewer claim that nested better-sqlite3 transactions are incompatible. Installed source `node_modules/better-sqlite3/lib/methods/transaction.js` explicitly uses SAVEPOINT/RELEASE/ROLLBACK TO when `db.inTransaction`; the outer transaction is valid when all repositories share the connection. Round 4 must use the real outer transaction in tests and add explicit DB compensation for failures after that transaction commits. Cost if wrong: savepoint behavior changes with dependency version; package lock pins the currently verified implementation.
- Task 7A1: fix round 4/5 (commit `4e9963b`; same-connection transaction/path leakage/report addressed; open High: fresh refresh rollback leaves settings rows, operation remains completed after compensation; Medium: unrelated snapshot incomplete). Four unsuccessful fix rounds exhausted; controller stopped for user direction per SDD policy.
- User decision: authorize an architectural reset rather than a fifth patch round. Replacement Task 7A1R will introduce explicit pre-state snapshots and idempotent database/filesystem compensation, then receive a fresh review.
- Task 7A1R initial commit `5e3cb77`; review NEEDS FIXES. Critical: pre-try filesystem failures bypass compensation/operation failure, raw errors may leak paths. Important: operation pre-state absent and A–G test claims lack direct test changes.
- Task 7A1R fix round 1/5 (`3b20659`): safe public errors and transaction shape addressed; open High: incomplete snapshot acquisition can trigger destructive compensation; open Medium: non-ENOENT stat/read treated as absence, operation snapshot unused; A–G direct tests still absent.
- Task 7A1R fix round 2/5 (`18b15e5`): production-critical findings resolved; 18 installer/27 Task 7 tests pass. Open Medium: unrelated recursive isolation only on catalog failure, not success/other failures. Open Low: idempotency only repository-level, not two installer compensations.
- Task 7A1R fix round 3/5 (`52b9d39`): Gates E/F addressed; 21 installer/30 Task 7 tests pass; replacement task approved. Minor deferred: one older pointer assertion is improperly awaited.
- Task 7A1R complete. Task 7A2 narrowed to pointer durability/failure/cleanup semantics not already covered by reset tests.
- Task 7A2 initial commit `ba7ec54`; review changes required. Important: unsupported Windows directory-open errors are not best-effort. Minor: failure matrix does not assert exact restoration of an existing pointer.
- Task 7A2 fix round 1/5 (`6f78b72`): both findings addressed; review approved; 27 installer/36 Task 7 tests.
- Task 7A3 initial commits `9881757`, `a55332d`; review rejected. Critical: 29 named rejection cases never apply their mutations and are false positives; no real multi-entry/concurrency test. Important: path checks have check/use races and permission digest duplicates canonical helper. Minor: unused symlink import/compressed misleading tests/report.
- Task 7A3 fix round 1/5 (`cfd37a2`): replaced false-positive suite with 39 real fixture tests, shared race-safe bounded reader, canonical permission digest, two-pass identity/digest, serialized refresh; review approved; 74 Task 7 + 20 inspector tests pass.
- Task 7A complete (installer transaction/durability + installed catalog). Task 7B Ruling: split into 7B0 cross-call consent lease, 7B1 inspection integration, 7B2 install integration. The global PackageLock must remain held while UI consent is pending; inspect returns through a separate readiness promise while the lock task waits for accept/cancel/expiry. Cost if wrong: long consent blocks unrelated package operations, matching the explicit global-lock safety requirement but potentially reducing UX concurrency.
- Task 7B0 initial commit `4d91896`; review changes requested. Important: public LeaseError retains raw cause/path. Minors: inspect-callback failure and complete error-object sanitization not directly tested.
- Task 7B0 fix round 1/5 (`c92fcc7`): error causes stripped and inspect-failure lifecycle covered; review approved.
- Task 7B1 initial commit `e203820`; review failed. Critical: lease-internal codes are outside shared PackageErrorCode and failures leave persistent operations incoherent. Important: configured-state repository absent with injected installer; unknown Official code normalization; health not asserted at verifier+commit boundaries; direct service test coverage effectively absent.
- Task 7B1 fix round 1/5 (`739282d`): shared terminal codes/persistence, double health check, repository-backed state, and 14 direct service tests; review approved. Minor deferred: redundant `entered` flag and duplicate observed ownerTask catch.
- Task 7B2 partial production commit `ebf69b6`, formatting `59e1d02`, tests/fixes `9572314`, cancellation race fix `f964711`; review approved. 53 focused / 139 Task 7 / 939 full tests.
- Task 7 complete through `f964711`; deferred minor: redundant lease `entered` flag/duplicate catch.
- Task 8 started: compose installed catalog with bundled URL Fetch and move all managed executable loading into Capability Host only. Brief: `.superpowers/sdd/2026-09-02-npm-capability-distribution-web-search/task-8-brief.md`.
- Task 7B2 partial production commit `ebf69b6` adds phases/abort/verification checks but no tests/report; task remains open.
- Task 7B2 BLOCKED by subagent infrastructure: original worker resume, fresh worker with explicit model, fresh worker default model, and persistent `Worker` session all fail immediately with provider `Not Found` before executing.
- Task 7B1 fix round 1: shared PackageErrorCode lease errors, exactly-once terminal outcomes before cleanup, coherent operation/progress terminal states, verifier/commit health boundaries, mandatory configured-state repository, and 14 direct service tests added. Verification: 7 Task 7 files / 115 tests pass; typecheck remains blocked only by the known unrelated renderer diagnostic.
- Task 8 implemented: composed bundled URL Fetch + installed npm catalog, strict main-to-host runtime descriptors, and host-only async managed imports with containment/digest/static-runtime validation and cache. Verification: 64 focused Task 8 tests, 139 Task 7 regression tests, Capability Host build pass; typecheck retains only known renderer blocker.
- Task 8 fix round 1: startup catalog readiness gate and stable failure state, pre-launch descriptor resolution/owned-host cleanup, and bounded JSON settings protocol. 72 Task 8 / 139 Task 7 tests and host build pass; known renderer typecheck blocker remains.
- Task 8 fix round 2: total post-launch HostManager startup boundary with exact-once child kill and listener/record cleanup; direct token/listener/postMessage failure coverage. 75 Task 8 / 139 Task 7 tests and host build pass.
- Task 8 fix round 3: locally owned listener/child cleanup survives disposer failures, attach-then-throw registration, and startup exit/map-removal races; pending requests clear and child kill remains exact-once. 77 Task 8 / 139 Task 7 tests and host build pass.
- Task 8 fix round 4: disposer fallback removal and full unexpected-exit local finalization; pending/listener/map ownership is released without redundant child kill. 78 Task 8 / 139 Task 7 tests and host build pass.
