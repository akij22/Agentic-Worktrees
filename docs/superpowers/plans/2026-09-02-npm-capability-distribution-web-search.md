# npm Capability Distribution and Web Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Web Search as `@agentic-worktrees/web-search` and let Marketplace and CLI users inspect, install, update, and remove npm Capabilities through one transactional Electron-main lifecycle.

**Architecture:** A reusable main-process package layer resolves npm registry sources into verified staging storage, while a Capability-specific inspector validates static metadata before consent and a disposable utility process validates executable exports after consent. Stable package records feed a composed bundled/installed Capability catalog; only the dedicated Capability Host dynamically loads managed code. Marketplace IPC and packaged-app CLI mode call the same distribution service and receive the same typed events and errors.

**Tech Stack:** TypeScript 5.9, Node 22, Electron 43 main/utility processes, React 19, Zod 4, Ajv 8, `pacote`, `npm-package-arg`, `semver`, SQLite/Drizzle, Vite 5, Vitest 4, Playwright Electron, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-02-npm-capability-distribution-web-search-design.md`

## Global Constraints

- Before Task 1, use `superpowers:using-git-worktrees` to create a clean isolated implementation worktree from the approved design branch; do not execute this plan in the current checkout with unrelated local changes.
- Use `npm` exclusively for dependencies, scripts, tests, builds, and package operations.
- Implement npm-distributed Capabilities only; npm Skills, mixed bundles, Git sources, URL archives, project package declarations, ratings, submissions, and strong sandboxing stay out of scope.
- Publish the first Capability as `@agentic-worktrees/web-search`; preserve Capability ID `agentic-worktrees.web-search` and tool name `web_search`.
- One npm package contains exactly one item kind and one Capability definition.
- A normal repository `npm install` never registers a Capability in Agentic Worktrees.
- Keep acquisition, verification, database access, filesystem access, catalog policy, CLI coordination, and executable loading outside the renderer.
- Never send managed paths, executable entry points, registry credentials, secrets, host tokens, or raw definitions across renderer IPC.
- Do not execute npm lifecycle scripts or dependency installers; every Capability package must contain self-contained executable output.
- Validate static package metadata before consent; load package code only after consent and only in a disposable verification utility process or dedicated Capability Host.
- Treat Community code as arbitrary Node.js code with the desktop user's access; never describe the existing process boundary as a sandbox.
- Official status comes only from a valid signed Agentic Worktrees catalog entry, never from npm scope or keywords alone.
- Install globally but never activate automatically; installed Capabilities become selectable in all chat pickers.
- Preserve current per-chat activation, optional encrypted secret storage, timeout, cancellation, output limits, and provider rollback behavior.
- Updates are explicit. Permission/content review is bound to package identity, exact version, registry integrity, and permission digest.
- Failed install/update/remove operations preserve or restore the prior stable state.
- Preserve existing Web Search settings, encrypted credential references, consent, and chat associations during migration; use `migration_pending` when acquisition cannot complete.
- Keep URL Fetch bundled in this project.
- Marketplace copy must not include “Try now” or “See what it does”.
- Preserve AppShell, Instrument Sans, Geist Mono, current dark palette, dense operational layout, keyboard access, focus states, and reduced-motion behavior.
- Database schema changes require `npm run db:generate`; do not manually edit generated migration artifacts.
- Follow TDD: run each focused test once while failing before production changes, then run it again while passing.
- Run `npm run typecheck` after every TypeScript task; run `npm run lint`, `npm test`, renderer build, and `npm run package` before completion.
- Do not run any npm registry publish command without explicit release authorization and confirmed credentials, package versions, target registry, and npm organization ownership.

---

## Planned File Structure

### Publishable package contract

- Modify `packages/capability-sdk/package.json` — public `dist` exports, files, build and prepack scripts.
- Create `packages/capability-sdk/tsconfig.build.json` — ESM JavaScript and declarations.
- Create `packages/capability-sdk/README.md` and `LICENSE` — public package usage and MIT terms.
- Modify `packages/capability-sdk/src/types.ts` — static Capability descriptor types.
- Modify `packages/capability-sdk/src/schema.ts` and `schema.test.ts` — safe unknown-value static descriptor validation.
- Modify `packages/capability-sdk/src/index.ts` — public validator/type exports.
- Modify `capabilities/web-search/package.json` — public package identity and Agentic Worktrees metadata.
- Create `capabilities/web-search/capability.json` — non-executable manifest and tool projection.
- Create `capabilities/web-search/vite.config.ts` — self-contained ESM runtime bundle.
- Create `capabilities/web-search/README.md` and `LICENSE` — public usage, provenance, and MIT terms while retaining the upstream license notice.
- Modify `capabilities/web-search/src/manifest.ts`, `src/index.ts`, and tests — consume the static descriptor as the metadata source of truth.
- Create `scripts/package-contract/package-contract.test.ts` — pack and external-consumer contract tests.
- Modify `package.json` and `package-lock.json` — package build/verification scripts and required dependencies.

### Shared lifecycle contracts and persistence

- Create `src/shared/packages/schemas.ts` and `schemas.test.ts` — source, state, inspection, request, result, progress, and stable error schemas.
- Modify `src/shared/ipc/schemas.ts` — provenance and installed lifecycle fields in Capability DTOs plus catalog-change events.
- Modify `src/shared/db/schema.ts` — managed installation and package operation tables.
- Modify `src/main/database/bootstrap.ts` and `src/main/database/index.ts` — fresh schema and additive upgrades.
- Generate the next files under `src/main/database/migrations/` and `src/main/database/migrations/meta/` with `npm run db:generate`; retain the exact basename emitted by Drizzle.
- Create `src/main/packages/package-repository.ts` and `.test.ts` — stable installations and operation journal persistence.

### Acquisition, catalog, and verification

- Create `src/main/packages/storage-layout.ts` and `.test.ts` — derived versioned, active-pointer, cache, and staging paths.
- Create `src/main/packages/package-lock.ts` and `.test.ts` — process and crash-safe global mutation lock.
- Create `src/main/packages/npm-source.ts` and `.test.ts` — registry-only source parsing.
- Create `src/main/packages/npm-acquirer.ts` and `.test.ts` — `pacote` adapter, integrity checks, extraction bounds, cancellation, and no scripts.
- Create `src/main/packages/content-digest.ts` and `.test.ts` — deterministic package tree digest.
- Create `catalog/official-capabilities.payload.json` — source payload for the Official catalog.
- Create `src/main/packages/catalog/official-catalog.fallback.json` — bundled fallback snapshot.
- Create `src/main/packages/catalog/official-catalog.ts` and `.test.ts` — signed remote envelope verification and fallback.
- Create `scripts/catalog/sign-official-catalog.ts` and `.test.ts` — release-only Ed25519 signing utility.
- Create `src/main/capabilities/package-inspector.ts` and `.test.ts` — static package/descriptor invariant checks.
- Create `src/main/capabilities/package-verification-protocol.ts` and `.test.ts` — bounded utility-process messages.
- Create `src/main/capabilities/package-verifier.ts` and `.test.ts` — main-side verifier client.
- Create `src/main/capabilities/package-verifier-entry.ts` — disposable executable validation entry.
- Create `vite.capability-verifier.config.ts` and modify `forge.config.ts` — package the verifier utility entry.

### Installation and runtime integration

- Create `src/main/capabilities/capability-package-installer.ts` and `.test.ts` — atomic commit, pointer swap, and compensation.
- Create `src/main/capabilities/capability-distribution-service.ts` and `.test.ts` — inspect/install/update/remove/reconcile lifecycle and progress.
- Create `src/main/capabilities/installed-catalog.ts` and `.test.ts` — validated cache of installed descriptors.
- Modify `src/main/capabilities/catalog.ts` and `.test.ts` — compose bundled URL Fetch and installed npm Capabilities.
- Modify `src/main/capabilities/host-protocol.ts` and tests — runtime descriptors in host messages.
- Modify `src/main/capabilities/host-registry.ts` and tests — asynchronous bundled/managed definition loading.
- Modify `src/main/capabilities/capability-host-server.ts` and tests — asynchronous runtime registry.
- Modify `src/main/capabilities/capability-host-manager.ts` and tests — descriptor resolution and host restart on version swaps.
- Modify `src/main/capabilities/capability-service.ts`, repository, and tests — injected composed catalog, global package states, update/remove session coordination.
- Modify `src/main.ts` — storage/catalog/distribution construction and migration-before-session reconciliation.

### Migration, IPC, Marketplace, and CLI

- Create `src/main/capabilities/web-search-migration.ts` and `.test.ts` — reviewed bundled-to-npm mapping and offline recovery.
- Modify `src/shared/ipc/channels.ts`, `src/shared/ipc/api.ts`, `src/preload.ts`, and tests — narrow Marketplace package APIs and lifecycle events.
- Create `src/main/ipc/marketplace-handlers.ts` and `.test.ts`; modify `src/main/ipc/index.ts` — validated thin handlers without GitHub authentication coupling.
- Create `src/renderer/features/marketplace/components/MarketplaceCapabilityDetail.tsx` and `.test.tsx` — install/update/remove/trust review surface.
- Create `src/renderer/features/marketplace/components/PackageProgress.tsx` and `.test.tsx` — four stable progress stages.
- Modify `src/renderer/features/marketplace/hooks/useMarketplace.ts` and tests — discovery, exact-spec inspection, operations, online migration retry, and event refresh.
- Modify `src/renderer/pages/Marketplace.tsx` and tests — approved Ecosystem Index layout, filters, states, and copy.
- Modify `src/renderer/features/capabilities/components/CapabilityPicker.tsx` and tests — installed catalog refresh and package-state grouping.
- Modify `src/renderer/features/capabilities/components/CapabilityDetail.tsx` and create `CapabilityDetail.test.tsx` — installed provenance and package-state presentation.
- Create `src/main/cli/arguments.ts` and `.test.ts` — command grammar.
- Create `src/main/cli/terminal-ui.ts` and `.test.ts` — review prompt, progress, and safe errors.
- Create `src/main/cli/command-protocol.ts` and `.test.ts` — authenticated local NDJSON protocol.
- Create `src/main/cli/command-coordinator.ts` and `.test.ts` — primary/secondary Electron process forwarding.
- Create `src/main/cli/run-command.ts` and `.test.ts` — shared distribution-service command execution.
- Refactor `src/main.ts` into `src/main/application-services.ts` and `src/main/application-bootstrap.ts` with focused tests — UI mode versus headless CLI mode.

### Verification and documentation

- Modify `scripts/capability-smoke/driver.mjs`, `run.mjs`, `web-search-scenario.mjs`, and tests — install package before real provider smoke.
- Modify `docs/capabilities/authoring-capabilities.md` — static descriptor, self-contained build, pack validation, and Community trust.
- Modify `README.md` — Marketplace and packaged-executable CLI commands.
- Create `docs/capabilities/publishing-official-capabilities.md` — signing and release checklist.

---

### Task 1: Make the Capability SDK Publishable and Add Static Descriptor Validation

**Files:**
- Modify: `packages/capability-sdk/package.json`
- Create: `packages/capability-sdk/tsconfig.build.json`
- Create: `packages/capability-sdk/README.md`
- Create: `packages/capability-sdk/LICENSE`
- Modify: `packages/capability-sdk/src/types.ts`
- Modify: `packages/capability-sdk/src/schema.ts`
- Modify: `packages/capability-sdk/src/schema.test.ts`
- Modify: `packages/capability-sdk/src/index.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `CapabilityManifest`, `CapabilityDefinition`, and `CapabilityTool`.
- Produces:

```ts
export interface CapabilityStaticTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CapabilityStaticDescriptor {
  manifest: CapabilityManifest;
  tools: readonly CapabilityStaticTool[];
}

export function validateCapabilityManifest(value: unknown): CapabilityManifest;
export function validateCapabilityStaticDescriptor(value: unknown): CapabilityStaticDescriptor;
export function staticDescriptorFromDefinition(
  definition: CapabilityDefinition,
): CapabilityStaticDescriptor;
```

- [ ] **Step 1: Write failing SDK tests for unknown-value validation**

Add cases that parse a complete descriptor and reject malformed nested properties without throwing a raw `TypeError`:

```ts
const validDescriptor = {
  manifest: {
    id: "agentic-worktrees.example",
    name: "Example",
    version: "1.0.0",
    sdkVersion: "^0.1.0",
    description: "Example capability.",
    category: "example",
    author: { name: "Agentic Worktrees" },
    license: "MIT",
    compatibility: { codex: "supported", opencode: "unsupported" },
    permissions: { network: [], secrets: [] },
    settings: {},
  },
  tools: [{
    name: "example_tool",
    description: "Run the example.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }],
};

expect(validateCapabilityStaticDescriptor(validDescriptor)).toMatchObject({
  manifest: { id: "agentic-worktrees.example" },
  tools: [{ name: "example_tool" }],
});
expect(() => validateCapabilityStaticDescriptor({ manifest: null, tools: [] }))
  .toThrowError(CapabilityError);
expect(() => validateCapabilityStaticDescriptor({
  ...validDescriptor,
  tools: [{ ...validDescriptor.tools[0], name: "Bad Tool" }],
})).toThrow("Invalid tool name");
```

Also assert duplicate tool names, invalid JSON Schema, duplicate network permissions, undeclared secret settings, unknown object keys, and more than 100 tools fail with `invalid_input` or `permission_denied`.

- [ ] **Step 2: Run the focused SDK test and verify failure**

Run:

```bash
npm test -- packages/capability-sdk/src/schema.test.ts
```

Expected: FAIL because static descriptor validators do not exist.

- [ ] **Step 3: Extract manifest validation and add static descriptor validation**

Use bounded structural checks before reading nested values. Reuse the existing ID, tool-name, permission, and Ajv checks. `validateCapabilityDefinition()` must call the same manifest validator and compare executable tools through the same static projection:

```ts
export function staticDescriptorFromDefinition(
  definition: CapabilityDefinition,
): CapabilityStaticDescriptor {
  return Object.freeze({
    manifest: validateCapabilityManifest(definition.manifest),
    tools: Object.freeze(definition.tools.map(({ name, description, inputSchema }) =>
      Object.freeze({ name, description, inputSchema: structuredClone(inputSchema) }),
    )),
  });
}
```

Return frozen clones so callers cannot mutate approved metadata after validation.

- [ ] **Step 4: Configure public SDK output**

Create `tsconfig.build.json` with `noEmit: false`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `rootDir: "src"`, and `outDir: "dist"`. Change SDK metadata to:

```json
{
  "name": "@agentic-worktrees/capability-sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "prepack": "npm run build"
  },
  "dependencies": {
    "ajv": "^8.20.0"
  }
}
```

Add root script `build:capability-packages` that runs SDK build before Capability workspace builds. Create SDK `README.md` with the public import/descriptor contract and `LICENSE` with the standard MIT text and repository copyright holder.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm test -- packages/capability-sdk/src/schema.test.ts packages/capability-sdk/src/output.test.ts
npm run build --workspace @agentic-worktrees/capability-sdk
npm run typecheck
```

Expected: tests PASS; `packages/capability-sdk/dist/index.js` and declarations are generated locally and ignored from Git.

- [ ] **Step 6: Commit the SDK contract**

```bash
git add packages/capability-sdk package.json
git commit -m "feat(capability-sdk): publish static descriptor contract"
```

---

### Task 2: Package Web Search as a Self-Contained Public npm Capability

**Files:**
- Modify: `capabilities/web-search/package.json`
- Create: `capabilities/web-search/capability.json`
- Create: `capabilities/web-search/vite.config.ts`
- Create: `capabilities/web-search/README.md`
- Create: `capabilities/web-search/LICENSE`
- Modify: `capabilities/web-search/src/manifest.ts`
- Modify: `capabilities/web-search/src/index.ts`
- Modify: `capabilities/web-search/src/index.test.ts`
- Create: `scripts/package-contract/package-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `CapabilityStaticDescriptor`, `validateCapabilityStaticDescriptor`, and `@agentic-worktrees/capability-sdk@0.1.0` from Task 1.
- Produces package metadata:

```ts
interface AgenticWorktreesPackageMetadata {
  kind: "capability";
  manifest: "./capability.json";
  entry: "./dist/index.js";
}
```

- [ ] **Step 1: Write a failing static/runtime parity test**

Import `capability.json`, validate it, create the runtime definition, and compare projections:

```ts
import descriptorJson from "../capability.json";
import {
  staticDescriptorFromDefinition,
  validateCapabilityStaticDescriptor,
} from "@agentic-worktrees/capability-sdk";
import webSearchCapability from "./index";

it("keeps packaged static metadata identical to runtime metadata", () => {
  const descriptor = validateCapabilityStaticDescriptor(descriptorJson);
  expect(staticDescriptorFromDefinition(webSearchCapability)).toEqual(descriptor);
  expect(descriptor.manifest.id).toBe("agentic-worktrees.web-search");
  expect(descriptor.tools.map(({ name }) => name)).toEqual(["web_search"]);
});
```

- [ ] **Step 2: Run the Web Search test and verify failure**

Run:

```bash
npm test -- capabilities/web-search/src/index.test.ts
```

Expected: FAIL because `capability.json` is absent.

- [ ] **Step 3: Move static metadata into `capability.json`**

Store the current manifest plus the exact `web_search` name, description, and input JSON Schema in the descriptor. Change `src/manifest.ts` to:

```ts
import descriptorJson from "../capability.json";
import { validateCapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";

export const webSearchDescriptor = validateCapabilityStaticDescriptor(descriptorJson);
export const webSearchManifest = webSearchDescriptor.manifest;
```

Use `webSearchDescriptor.tools[0]` for runtime name, description, and input schema in `src/index.ts`; keep only `execute` in executable source.

- [ ] **Step 4: Configure the public package and self-contained bundle**

Rename the package to `@agentic-worktrees/web-search`, remove `private`, export `dist/index.js`, set `files` to `["dist", "capability.json", "README.md", "LICENSE", "LICENSE.pi-web-access"]`, and add:

```json
{
  "agenticWorktrees": {
    "kind": "capability",
    "manifest": "./capability.json",
    "entry": "./dist/index.js"
  },
  "keywords": ["agentic-worktrees-capability"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "vite build --config vite.config.ts",
    "prepack": "npm run build"
  }
}
```

The Vite library build targets Node 22 ESM, bundles SDK/Ajv and Web Search dependencies, externalizes Node built-ins only, disables source maps in the published output, and emits `dist/index.js`. Create `README.md` with install, manifest, keyless/optional Exa behavior, and trust information. Create the package MIT `LICENSE` and retain `LICENSE.pi-web-access` as the upstream provenance notice; include both license files in the tarball.

- [ ] **Step 5: Write a failing packed-artifact test**

The test creates `temporaryDirectory` with `mkdtemp()`, runs `npm pack --json --workspace @agentic-worktrees/web-search --pack-destination ${temporaryDirectory}`, lists tarball files with `tar -tf`, extracts it, and imports the extracted `dist/index.js`. Assert:

```ts
expect(files).toEqual(expect.arrayContaining([
  "package/package.json",
  "package/capability.json",
  "package/dist/index.js",
]));
expect(files.some((file) => file.includes("src/") || file.endsWith(".map"))).toBe(false);
expect(definition.manifest.id).toBe("agentic-worktrees.web-search");
expect(definition.tools.map((tool) => tool.name)).toEqual(["web_search"]);
```

Also run the import with an empty external `node_modules` directory to prove the runtime artifact is self-contained.

- [ ] **Step 6: Run pack tests, update the lockfile, and verify**

Run:

```bash
npm install
npm test -- capabilities/web-search/src/index.test.ts scripts/package-contract/package-contract.test.ts
npm run build --workspace @agentic-worktrees/web-search
npm run typecheck
```

Expected: tests PASS and the pack test leaves no tarball in the repository.

- [ ] **Step 7: Commit the Web Search package**

```bash
git add capabilities/web-search scripts/package-contract package.json package-lock.json
git commit -m "feat(web-search): prepare public self-contained package"
```

---

### Task 3: Define Shared Package Lifecycle Schemas and Persistence

**Files:**
- Create: `src/shared/packages/schemas.ts`
- Create: `src/shared/packages/schemas.test.ts`
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/shared/ipc/schemas.test.ts`
- Modify: `src/shared/db/schema.ts`
- Modify: `src/main/database/bootstrap.ts`
- Modify: `src/main/database/index.ts`
- Modify: `src/main/database/index.test.ts`
- Create: `src/main/packages/package-repository.ts`
- Create: `src/main/packages/package-repository.test.ts`
- Generate: next Drizzle-emitted SQL file under `src/main/database/migrations/`
- Generate: matching Drizzle-emitted snapshot under `src/main/database/migrations/meta/`
- Modify generated: `src/main/database/migrations/meta/_journal.json` through Drizzle generation only

**Interfaces:**
- Produces:

```ts
export type PackageItemKind = "capability" | "skill";
export type PackageTrust = "official" | "community";
export type PackageReviewStatus = "official-reviewed" | "unreviewed";
export type ManagedPackageState =
  | "installed"
  | "incompatible"
  | "blocked"
  | "invalid"
  | "migration_pending";
export type PackageOperationAction =
  | "inspect"
  | "install"
  | "update"
  | "remove"
  | "migrate";
export type PackageOperationStage =
  | "resolving"
  | "downloading"
  | "verifying"
  | "installing"
  | "removing";
export type PackageOperationStatus =
  | "in_progress"
  | "awaiting_consent"
  | "completed"
  | "failed"
  | "cancelled";
```

The shared records and requests use these exact shapes:

```ts
export type PackageErrorCode =
  | "package_not_found"
  | "package_version_not_found"
  | "package_source_invalid"
  | "package_integrity_failed"
  | "package_archive_invalid"
  | "package_manifest_invalid"
  | "package_kind_unsupported"
  | "package_incompatible"
  | "package_blocked"
  | "package_permission_denied"
  | "package_busy"
  | "package_download_failed"
  | "package_verification_failed"
  | "package_install_failed"
  | "package_update_failed"
  | "package_remove_failed"
  | "package_sync_failed";

export interface ManagedPackageInstallationRecord {
  packageName: string;
  itemKind: PackageItemKind;
  itemId: string;
  requestedSpec: string;
  activeVersion?: string;
  activeIntegrity?: string;
  activeContentDigest?: string;
  trust: PackageTrust;
  reviewStatus: PackageReviewStatus;
  acceptedPermissionDigest?: string;
  state: ManagedPackageState;
  errorCode?: PackageErrorCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface PackageOperationRecord {
  operationId: string;
  action: PackageOperationAction;
  stage: PackageOperationStage;
  status: PackageOperationStatus;
  packageName?: string;
  requestedSpec: string;
  candidateVersion?: string;
  candidateIntegrity?: string;
  candidateContentDigest?: string;
  errorCode?: PackageErrorCode;
  createdAt: Date;
  updatedAt: Date;
}

export type CapabilityInstallationStateDto =
  | "available"
  | "installing"
  | "installed"
  | "needs_setup"
  | "update_available"
  | "updating"
  | "incompatible"
  | "blocked"
  | "invalid"
  | "removing"
  | "migration_pending";

export interface PackageInspectRequest {
  sourceSpec: string;
  officialCapabilityId?: string;
}

export interface PackageInstallRequest {
  inspectionId: string;
  acceptedPackageName: string;
  acceptedVersion: string;
  acceptedIntegrity: string;
  acceptedPermissionDigest: string;
}

export interface PackageUpdateRequest extends PackageInstallRequest {
  packageName: string;
  acceptedDowngrade: boolean;
  acceptedActiveRunCount: number;
}

export interface PackageRemoveRequest {
  packageName: string;
  acceptedActiveRunCount: number;
}

export interface CapabilityUpdateDto {
  packageName: string;
  capabilityId: string;
  currentVersion: string;
  candidateVersion: string;
  releaseNotes: string;
  permissionChanged: boolean;
  downgrade: boolean;
  requiresSetup: boolean;
  activeRunCount: number;
}

export interface CapabilityDistributionProgress {
  operationId: string;
  capabilityId?: string;
  packageName?: string;
  action: PackageOperationAction;
  stage: PackageOperationStage;
  status: PackageOperationStatus;
  errorCode?: PackageErrorCode;
  updatedAt: string;
}
```

`CapabilitySummaryDto` and `CapabilityDetailDto` gain `installationState: CapabilityInstallationStateDto`, `source: "bundled" | "npm"`, optional `packageName`, and `trust: "built-in" | "official" | "community"`. `CapabilityDetailDto` also gains `activeRunCount: number` so removal confirmation can detect stale reviews without exposing run IDs. Existing `state` remains the per-chat/setup state used by `CapabilityService`.

- [ ] **Step 1: Write failing schema tests**

Test exact npm package names, operation state, safe errors, and strict request stripping:

```ts
expect(packageSourceSpecSchema.parse("@agentic-worktrees/web-search@0.1.0"))
  .toBe("@agentic-worktrees/web-search@0.1.0");
expect(() => packageSourceSpecSchema.parse("git+https://example.com/repo.git"))
  .toThrow();
expect(packageInstallRequestSchema.parse({
  inspectionId: "inspection-1",
  acceptedPackageName: "@agentic-worktrees/web-search",
  acceptedVersion: "0.1.0",
  acceptedIntegrity: "sha512-value",
  acceptedPermissionDigest: "permission-digest",
  executablePath: "/must/not/cross/ipc",
})).not.toHaveProperty("executablePath");
expect(packageErrorCodeSchema.parse("package_integrity_failed"))
  .toBe("package_integrity_failed");
```

Define every stable error code from spec section 15 in one schema.

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```bash
npm test -- src/shared/packages/schemas.test.ts src/shared/ipc/schemas.test.ts
```

Expected: FAIL because package lifecycle schemas do not exist.

- [ ] **Step 3: Implement strict shared DTO schemas**

Define `CapabilityPackageInspectionDto` with no local paths:

```ts
export interface CapabilityPackageInspectionDto {
  inspectionId: string;
  packageName: string;
  requestedSpec: string;
  resolvedVersion: string;
  integrity: string;
  contentDigest: string;
  trust: PackageTrust;
  reviewStatus: PackageReviewStatus;
  releaseNotes: string;
  capability: CapabilityDetailDto;
  permissionDigest: string;
  expiresAt: string;
}
```

Extend Capability summary/detail DTOs with `source: "bundled" | "npm"`, package identity, trust/review status, and installation state. Set detail `reviewStatus` to `"bundled-reviewed" | "official-reviewed" | "unreviewed"`, preserving `bundled-reviewed` for URL Fetch.

- [ ] **Step 4: Write failing database and repository tests**

Assert a stable installation and an in-progress operation can coexist, commit replaces only active metadata, migration records permit null active metadata, and package/item collisions fail atomically:

```ts
repository.saveMigrationPending({
  packageName: "@agentic-worktrees/web-search",
  itemKind: "capability",
  itemId: "agentic-worktrees.web-search",
  requestedSpec: "@agentic-worktrees/web-search@0.1.0",
  trust: "official",
  reviewStatus: "official-reviewed",
  permissionDigest: "digest",
});
expect(repository.getByItemId("capability", "agentic-worktrees.web-search"))
  .toMatchObject({ state: "migration_pending", activeVersion: undefined });
```

- [ ] **Step 5: Add Drizzle schema and generate migration artifacts**

Create `managed_package_installations` and `managed_package_operations` with unique `(item_kind, item_id)`, operation status/stage indexes, foreign-key-safe package identity, nullable active fields only for `migration_pending`, and millisecond timestamps.

Run:

```bash
npm run db:generate
```

Review generated SQL and snapshot; do not edit them manually. Mirror the tables in `bootstrapSchemaSql`. Extend `applyDatabaseUpgrades()` with idempotent `CREATE TABLE IF NOT EXISTS`/index statements for users whose database predates generated migration execution.

- [ ] **Step 6: Implement `ManagedPackageRepository` transactions**

Expose exact methods:

```ts
interface MigrationPendingInput {
  packageName: string;
  itemKind: PackageItemKind;
  itemId: string;
  requestedSpec: string;
  trust: PackageTrust;
  reviewStatus: PackageReviewStatus;
  permissionDigest?: string;
}

interface BeginPackageOperationInput {
  operationId: string;
  action: PackageOperationAction;
  stage: PackageOperationStage;
  packageName?: string;
  requestedSpec: string;
}

interface PackageCandidateMetadata {
  packageName: string;
  version: string;
  integrity: string;
  contentDigest: string;
}

interface StableInstallationInput extends MigrationPendingInput {
  activeVersion: string;
  activeIntegrity: string;
  activeContentDigest: string;
  permissionDigest: string;
  state: Exclude<ManagedPackageState, "migration_pending">;
}

class ManagedPackageRepository {
  getByPackageName(packageName: string): ManagedPackageInstallationRecord | undefined;
  getByItemId(kind: PackageItemKind, itemId: string): ManagedPackageInstallationRecord | undefined;
  list(kind?: PackageItemKind): ManagedPackageInstallationRecord[];
  saveMigrationPending(input: MigrationPendingInput): ManagedPackageInstallationRecord;
  beginOperation(input: BeginPackageOperationInput): PackageOperationRecord;
  markAwaitingConsent(operationId: string, candidate: PackageCandidateMetadata): PackageOperationRecord;
  commitInstallation(operationId: string, input: StableInstallationInput): ManagedPackageInstallationRecord;
  failOperation(operationId: string, code: PackageErrorCode): PackageOperationRecord;
  cancelOperation(operationId: string): PackageOperationRecord;
  deleteInstallation(packageName: string): void;
  listInterruptedOperations(): PackageOperationRecord[];
}
```

Use SQLite transactions for every operation-state plus installation-state mutation.

- [ ] **Step 7: Run persistence verification**

Run:

```bash
npm test -- src/shared/packages/schemas.test.ts src/shared/ipc/schemas.test.ts src/main/packages/package-repository.test.ts src/main/database/index.test.ts
npm run typecheck
```

Expected: all focused tests PASS and schema/migration files agree.

- [ ] **Step 8: Commit contracts and generated database artifacts**

```bash
git add src/shared/packages src/shared/ipc/schemas.ts src/shared/ipc/schemas.test.ts src/shared/db/schema.ts src/main/database src/main/packages/package-repository.ts src/main/packages/package-repository.test.ts
git commit -m "feat(packages): persist managed package lifecycle"
```

---

### Task 4: Acquire npm Packages into Bounded Managed Staging

**Files:**
- Create: `src/main/packages/storage-layout.ts`
- Create: `src/main/packages/storage-layout.test.ts`
- Create: `src/main/packages/package-lock.ts`
- Create: `src/main/packages/package-lock.test.ts`
- Create: `src/main/packages/npm-source.ts`
- Create: `src/main/packages/npm-source.test.ts`
- Create: `src/main/packages/npm-acquirer.ts`
- Create: `src/main/packages/npm-acquirer.test.ts`
- Create: `src/main/packages/content-digest.ts`
- Create: `src/main/packages/content-digest.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces:

```ts
export interface ManagedPackageLayout {
  root: string;
  packagesRoot: string;
  activeRoot: string;
  stagingRoot: string;
  cacheRoot: string;
  packageVersionRoot(itemId: string, version: string): string;
  activePointerPath(itemId: string): string;
  stagingOperationRoot(operationId: string): string;
  assertManagedPath(candidate: string): string;
}

export interface ResolvedNpmSource {
  requestedSpec: string;
  packageName: string;
  resolvedVersion: string;
  integrity: string;
  unpackedSize?: number;
}

export interface StagedNpmPackage extends ResolvedNpmSource {
  operationId: string;
  packageRoot: string;
  packageJson: unknown;
  contentDigest: string;
}

export interface NpmRegistryAdapter {
  resolve(spec: string, signal: AbortSignal): Promise<ResolvedNpmSource>;
  extract(source: ResolvedNpmSource, destination: string, signal: AbortSignal): Promise<void>;
}
```

- [ ] **Step 1: Write failing source/layout/lock tests**

Cover scoped, unscoped, exact, tag, and documented `npm:` syntax; reject Git/file/URL/alias/workspace specs. Assert IDs/versions cannot escape the root. Assert two contenders serialize and a stale lock owned by a dead PID is recoverable only after its timestamp exceeds 60 seconds.

```ts
expect(parseNpmSourceSpec("npm:@agentic-worktrees/web-search@0.1.0")).toEqual({
  requestedSpec: "@agentic-worktrees/web-search@0.1.0",
  packageName: "@agentic-worktrees/web-search",
});
expect(() => parseNpmSourceSpec("file:../capability")).toThrow("npm registry");
expect(() => layout.packageVersionRoot("../escape", "1.0.0")).toThrow();
```

- [ ] **Step 2: Run source/layout/lock tests and verify failure**

Run:

```bash
npm test -- src/main/packages/npm-source.test.ts src/main/packages/storage-layout.test.ts src/main/packages/package-lock.test.ts
```

Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement parsing, derived paths, and the global lock**

Use `npm-package-arg` for registry parsing after stripping one documented leading `npm:`. Use `fs.open(lockPath, "wx", 0o600)` for the cross-process lock and an in-process promise mutex to serialize callers. Store `{ pid, acquiredAt }`; never remove a non-stale lock owned by a live process.

- [ ] **Step 4: Write failing acquisition and digest tests**

Use a fake `NpmRegistryAdapter`; do not call the public registry in unit tests. Assert:

- progress order is `resolving`, `downloading`, `verifying`;
- declared unpacked size above 50 MiB is rejected before extraction;
- extracted trees above 50 MiB or 5,000 entries are rejected;
- package root must contain `package.json`;
- lifecycle scripts are never called;
- abort removes staging;
- a changed byte changes the sorted path/mode/content SHA-256 digest;
- symlinks and hard links are rejected by post-extraction walk.

- [ ] **Step 5: Implement the `pacote` production adapter and acquirer**

Install dependencies with:

```bash
npm install pacote npm-package-arg semver
npm install --save-dev @types/pacote @types/npm-package-arg @types/semver
```

Use the lockfile-resolved versions throughout this plan. `pacote.manifest()` resolves registry metadata and `pacote.extract()` extracts only; do not call npm CLI or install dependencies. Pass the resolved integrity and app-owned cache directory. After extraction, use `lstat`, `realpath`, entry count, byte count, and root containment checks before reading a maximum 256 KiB `package.json`.

The public method is:

```ts
class NpmPackageAcquirer {
  acquire(
    operationId: string,
    sourceSpec: string,
    signal: AbortSignal,
    onStage: (stage: PackageOperationStage) => void,
  ): Promise<StagedNpmPackage>;
  discard(operationId: string): Promise<void>;
}
```

- [ ] **Step 6: Run acquisition verification**

Run:

```bash
npm install
npm test -- src/main/packages/npm-source.test.ts src/main/packages/storage-layout.test.ts src/main/packages/package-lock.test.ts src/main/packages/npm-acquirer.test.ts src/main/packages/content-digest.test.ts
npm run typecheck
```

Expected: focused tests PASS without external network access.

- [ ] **Step 7: Commit acquisition infrastructure**

```bash
git add src/main/packages package.json package-lock.json
git commit -m "feat(packages): acquire npm artifacts safely"
```

---

### Task 5: Add the Signed Official Capability Catalog

**Files:**
- Create: `catalog/official-capabilities.payload.json`
- Create: `src/main/packages/catalog/official-catalog.fallback.json`
- Create: `src/main/packages/catalog/official-catalog.ts`
- Create: `src/main/packages/catalog/official-catalog.test.ts`
- Create: `scripts/catalog/sign-official-catalog.ts`
- Create: `scripts/catalog/sign-official-catalog.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:

```ts
export interface OfficialCatalogEntry {
  capabilityId: string;
  packageName: string;
  releaseSpec: string;
  publisher: string;
  minimumAppVersion: string;
  blockedVersions: readonly string[];
  descriptor: CapabilityStaticDescriptor;
  releaseNotes: string;
  updatedAt: string;
}

export interface OfficialCatalogSnapshot {
  schemaVersion: 1;
  sequence: number;
  issuedAt: string;
  expiresAt: string;
  entries: readonly OfficialCatalogEntry[];
}

export interface SignedCatalogEnvelope {
  algorithm: "Ed25519";
  keyId: string;
  payload: string;
  signature: string;
}

export interface LoadedOfficialCatalog {
  source: "remote" | "cache" | "fallback";
  snapshot: OfficialCatalogSnapshot;
  warningCode?: "catalog_unavailable" | "catalog_signature_invalid" | "catalog_expired";
}

export class OfficialCatalogService {
  load(options?: { refresh?: boolean }): Promise<LoadedOfficialCatalog>;
  findCapability(capabilityId: string): Promise<OfficialCatalogEntry | undefined>;
}
```

`payload` is base64url-encoded exact UTF-8 JSON bytes. Signature verification happens before JSON parsing, avoiding canonicalization ambiguity.

- [ ] **Step 1: Write failing catalog validation tests**

Generate a test-only Ed25519 key pair. Assert a valid envelope is accepted and these cases use the fallback: invalid signature, unknown key ID, expired payload, sequence rollback, schema mismatch, duplicate Capability ID, package identity mismatch, and blocked fallback version.

```ts
await expect(service.load({ refresh: true })).resolves.toMatchObject({
  source: "remote",
  snapshot: { sequence: 2 },
});
expect(await invalidSignatureService.load({ refresh: true })).toMatchObject({
  source: "fallback",
  warningCode: "catalog_signature_invalid",
});
```

- [ ] **Step 2: Run catalog tests and verify failure**

Run:

```bash
npm test -- src/main/packages/catalog/official-catalog.test.ts scripts/catalog/sign-official-catalog.test.ts
```

Expected: FAIL because catalog modules do not exist.

- [ ] **Step 3: Implement signed loading and release signing**

Use `crypto.verify(null, payloadBytes, publicKey, signatureBytes)`. Inject `fetchImpl`, clock, endpoint, and public keys for tests. Production endpoint:

```text
https://raw.githubusercontent.com/akij22/Agentic-Worktrees/main/catalog/official-capabilities.envelope.json
```

Bound responses to 1 MiB and a 5-second timeout. Cache the last valid remote payload in managed package storage; never replace cache with invalid data. The signing script reads `AGENTIC_WORKTREES_CATALOG_PRIVATE_KEY` only in the release script process, verifies that it is absent from output/logs, and writes `catalog/official-capabilities.envelope.json`.

- [ ] **Step 4: Add the first Official entry and fallback**

Both payload and fallback contain Web Search with package `@agentic-worktrees/web-search`, release `0.1.0`, Capability ID `agentic-worktrees.web-search`, tools `web_search`, current compatibility, release notes `Initial public npm release; behavior matches bundled Web Search.`, an ISO-8601 `updatedAt`, and no blocked versions. Add root script:

```json
"catalog:sign": "tsx scripts/catalog/sign-official-catalog.ts"
```

Do not add a private key or signed production envelope without release authorization.

- [ ] **Step 5: Run catalog verification**

Run:

```bash
npm test -- src/main/packages/catalog/official-catalog.test.ts scripts/catalog/sign-official-catalog.test.ts
npm run typecheck
```

Expected: valid signatures use remote data; all invalid remote cases safely use fallback.

- [ ] **Step 6: Commit catalog policy**

```bash
git add catalog/official-capabilities.payload.json src/main/packages/catalog scripts/catalog package.json
git commit -m "feat(marketplace): verify signed official catalog"
```

---

### Task 6: Inspect Static Capability Metadata Before Executing Code

**Files:**
- Create: `src/main/capabilities/package-inspector.ts`
- Create: `src/main/capabilities/package-inspector.test.ts`
- Create: `src/main/capabilities/package-verification-protocol.ts`
- Create: `src/main/capabilities/package-verification-protocol.test.ts`
- Create: `src/main/capabilities/package-verifier.ts`
- Create: `src/main/capabilities/package-verifier.test.ts`
- Create: `src/main/capabilities/package-verifier-entry.ts`
- Create: `vite.capability-verifier.config.ts`
- Modify: `forge.config.ts`

**Interfaces:**
- Produces:

```ts
export interface InspectedCapabilityPackage {
  staged: StagedNpmPackage;
  packageMetadata: {
    kind: "capability";
    manifest: string;
    entry: string;
  };
  descriptor: CapabilityStaticDescriptor;
  permissionDigest: string;
  trust: PackageTrust;
  reviewStatus: PackageReviewStatus;
}

export interface CapabilityExecutableVerification {
  capabilityId: string;
  version: string;
  toolNames: readonly string[];
  contentDigest: string;
}

export interface CapabilityPackageVerifier {
  verify(
    inspected: InspectedCapabilityPackage,
    signal: AbortSignal,
  ): Promise<CapabilityExecutableVerification>;
}
```

- [ ] **Step 1: Write failing static inspector tests**

Create temporary packages and assert rejection for missing metadata, wrong kind, absolute/traversing manifest or entry paths, package/manifest version mismatch, invalid static descriptor, Capability ID collision, unsupported SDK range, unsupported app version, lifecycle scripts, and Official package identity mismatch.

Assert the inspector does not import the entry by writing an entry that creates a marker file and proving the marker remains absent.

```ts
const inspected = await inspector.inspect(staged, {
  trust: "community",
  reviewStatus: "unreviewed",
});
expect(inspected.descriptor.manifest.id).toBe("agentic-worktrees.example");
expect(existsSync(markerPath)).toBe(false);
```

- [ ] **Step 2: Run inspector tests and verify failure**

Run:

```bash
npm test -- src/main/capabilities/package-inspector.test.ts
```

Expected: FAIL because the inspector is absent.

- [ ] **Step 3: Implement data-only inspection**

Read at most 256 KiB each for `package.json` and `capability.json`. Validate the static descriptor with the SDK. Use `semver.satisfies()` for SDK/application compatibility. Compute permission digest from normalized permissions plus Capability version. Reject any `preinstall`, `install`, `postinstall`, or `prepare` script even though the acquirer never runs scripts.

- [ ] **Step 4: Write failing verifier protocol/client tests**

Protocol messages must be strict and bounded:

```ts
const request = {
  type: "capability.verify",
  requestId: "verify-1",
  packageRoot: "/managed/staging/op/package",
  entry: "./dist/index.js",
  expectedContentDigest: "sha256-value",
  expectedDescriptor: descriptor,
};
expect(capabilityVerificationRequestSchema.parse(request)).toEqual(request);
expect(() => capabilityVerificationRequestSchema.parse({
  ...request,
  rendererPath: "/untrusted",
})).toThrow();
```

Test timeout, malformed child output, child crash, cancellation, digest mismatch, static/runtime descriptor mismatch, and successful tool-name response with a fake utility process.

- [ ] **Step 5: Implement disposable verification**

The main-side client launches `capability-package-verifier.js` with a service name, posts one request, enforces a 10-second timeout, and always kills the child after one result. The utility entry:

1. asserts root and entry containment;
2. recomputes the content digest;
3. imports the entry with `pathToFileURL(entryPath).href` plus a digest query;
4. validates the default export as a Capability definition;
5. projects it with `staticDescriptorFromDefinition()`;
6. requires deep equality with the approved static descriptor;
7. emits only Capability ID, version, tool names, and digest.

Raw import errors never cross the process boundary.

- [ ] **Step 6: Package the verifier utility entry**

Create a Node 22 CJS Vite build parallel to `vite.capability-host.config.ts`, output `capability-package-verifier.js`, and add it to Forge's `build` entries.

- [ ] **Step 7: Run verification tests**

Run:

```bash
npm test -- src/main/capabilities/package-inspector.test.ts src/main/capabilities/package-verification-protocol.test.ts src/main/capabilities/package-verifier.test.ts
npm run typecheck
npm run package
```

Expected: unit tests PASS and packaged app contains both utility entries.

- [ ] **Step 8: Commit static and executable verification**

```bash
git add src/main/capabilities/package-* vite.capability-verifier.config.ts forge.config.ts
git commit -m "feat(capabilities): verify external packages after consent"
```

---

### Task 7: Implement Transactional Inspect and Fresh Install

**Files:**
- Create: `src/main/capabilities/capability-package-installer.ts`
- Create: `src/main/capabilities/capability-package-installer.test.ts`
- Create: `src/main/capabilities/capability-distribution-service.ts`
- Create: `src/main/capabilities/capability-distribution-service.test.ts`
- Create: `src/main/capabilities/installed-catalog.ts`
- Create: `src/main/capabilities/installed-catalog.test.ts`
- Modify: `src/main/capabilities/capability-repository.ts`
- Modify: `src/main/capabilities/capability-repository.test.ts`

**Interfaces:**
- Consumes: shared `CapabilityDistributionProgress`, `PackageInspectRequest`, and package request DTOs from Task 3.
- Produces:

```ts
export class CapabilityPackageInstaller {
  commitFresh(
    inspected: InspectedCapabilityPackage,
    verification: CapabilityExecutableVerification,
  ): Promise<ManagedPackageInstallationRecord>;
}

export interface InstalledCapabilityEntry {
  record: ManagedPackageInstallationRecord;
  descriptor: CapabilityStaticDescriptor;
  manifestRelativePath: string;
  entryRelativePath: string;
}

export class InstalledCapabilityCatalog {
  list(): readonly InstalledCapabilityEntry[];
  get(capabilityId: string, version?: string): InstalledCapabilityEntry | undefined;
  refresh(): Promise<void>;
}

export class CapabilityDistributionService {
  listMarketplaceCapabilities(): Promise<CapabilitySummaryDto[]>;
  getInstalledCapability(packageName: string): Promise<CapabilityDetailDto>;
  inspect(input: PackageInspectRequest): Promise<CapabilityPackageInspectionDto>;
  install(input: PackageInstallRequest): Promise<CapabilityDetailDto>;
  subscribe(listener: (event: CapabilityDistributionProgress) => void): () => void;
  cancel(operationId: string): Promise<void>;
  reconcileInterruptedOperations(): Promise<void>;
}
```

`CapabilityPackageInstaller.commitFresh()` receives only a post-consent executable verification and returns a stable installation. `InstalledCapabilityCatalog.refresh()` atomically replaces an immutable in-memory snapshot after validating every active pointer.

- [ ] **Step 1: Write failing installer transaction tests**

Use a temporary layout and in-memory SQLite. Assert:

- package is copied/moved to `packages/${capabilityId}/${version}`;
- `active/${capabilityId}.json` is an atomic pointer file containing package name, version, integrity, digest, manifest path, and entry path;
- DB commit happens only after committed-path verification;
- pointer/DB failure removes a fresh package;
- existing unrelated packages are untouched;
- destination collision with different digest fails closed;
- no local path appears in returned DTOs or emitted events.

- [ ] **Step 2: Run installer tests and verify failure**

Run:

```bash
npm test -- src/main/capabilities/capability-package-installer.test.ts
```

Expected: FAIL because installer and active pointer do not exist.

- [ ] **Step 3: Implement atomic fresh commit and installed catalog**

Use same-filesystem staging under the managed root. Write pointer JSON to a sibling temporary file, `fsync`, rename atomically, then commit the DB transaction. If DB commit fails, remove the new pointer/package; if cleanup fails, record `invalid` and log only the stable error code.

`InstalledCapabilityCatalog.refresh()` must reject pointer paths outside the layout, mismatched DB/pointer metadata, missing files, and descriptor/digest mismatch. Keep the previous valid snapshot if refresh fails.

- [ ] **Step 4: Write failing distribution-service inspection/install tests**

Test Official and Community flows:

```ts
const inspection = await service.inspect({
  sourceSpec: "@community/search@1.0.0",
});
expect(inspection).toMatchObject({
  trust: "community",
  reviewStatus: "unreviewed",
  packageName: "@community/search",
});
expect(verifier.verify).not.toHaveBeenCalled();

await expect(service.install({
  inspectionId: inspection.inspectionId,
  acceptedPackageName: inspection.packageName,
  acceptedVersion: inspection.resolvedVersion,
  acceptedIntegrity: inspection.integrity,
  acceptedPermissionDigest: inspection.permissionDigest,
})).resolves.toMatchObject({ source: "npm", state: "ready" });
expect(verifier.verify).toHaveBeenCalledTimes(1);
```

The successful fixture has only defaults and optional secrets, matching Web Search. Add a second fixture with a required setting without a default and assert `state: "needs_setup"`. Also assert no session record is created and no activation method is called. Cover consent mismatch, expired 15-minute inspection, cancellation, duplicate item/package IDs, changed staged digest, and concurrent operation lock failure.

- [ ] **Step 5: Implement inspect/install orchestration**

`inspect()` acquires, statically validates, stores an `awaiting_consent` operation, and returns a path-free DTO. `install()` compares every accepted field to the stored inspection, runs executable verification, commits atomically, refreshes installed catalog, emits `completed`, and discards staging. Community trust is never inferred from package scope.

Add `CapabilityRepository.initializeInstalledConfiguration(manifest, permissionDigest)`. In the same SQLite transaction as the stable managed-package commit, persist manifest defaults and mark configuration ready when every required non-secret setting has a default and the manifest declares no required secret. Otherwise preserve consent/defaults with `configured: false`, producing `needs_setup`. This makes Web Search ready for keyless selection immediately after install without creating a session activation.

Interrupted `inspect`/`install` operations are marked failed and their staging removed at startup; no stable installation is created.

- [ ] **Step 6: Run fresh-install verification**

Run:

```bash
npm test -- src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/installed-catalog.test.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-repository.test.ts
npm run typecheck
```

Expected: all fresh-install and recovery tests PASS.

- [ ] **Step 7: Commit transactional installation**

```bash
git add src/main/capabilities/capability-package-installer.ts src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/capability-distribution-service.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/installed-catalog.ts src/main/capabilities/installed-catalog.test.ts src/main/capabilities/capability-repository.ts src/main/capabilities/capability-repository.test.ts
git commit -m "feat(capabilities): install verified npm packages atomically"
```

---

### Task 8: Compose Installed Capabilities and Load Them Only in the Capability Host

**Files:**
- Modify: `src/main/capabilities/catalog.ts`
- Modify: `src/main/capabilities/catalog.test.ts`
- Modify: `src/main/capabilities/host-protocol.ts`
- Create or modify: `src/main/capabilities/host-protocol.test.ts`
- Modify: `src/main/capabilities/host-registry.ts`
- Modify: `src/main/capabilities/host-registry.test.ts`
- Modify: `src/main/capabilities/capability-host-server.ts`
- Modify: `src/main/capabilities/capability-host-server.test.ts`
- Modify: `src/main/capabilities/capability-host-manager.ts`
- Modify: `src/main/capabilities/capability-host-manager.test.ts`
- Modify: `src/main/capabilities/capability-service.ts`
- Modify: `src/main/capabilities/capability-service.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:

```ts
export type CapabilityRuntimeDescriptor =
  | { kind: "bundled"; capabilityId: string; version: string }
  | {
      kind: "managed";
      capabilityId: string;
      packageName: string;
      version: string;
      packageRoot: string;
      manifest: string;
      entry: string;
      contentDigest: string;
    };

export interface CapabilityCatalogEntry {
  manifest: CapabilityManifest;
  reviewStatus: "bundled-reviewed" | "official-reviewed" | "unreviewed";
  trust: "built-in" | "official" | "community";
  source: "bundled" | "npm";
  packageName?: string;
  toolNames: readonly string[];
  runtime: CapabilityRuntimeDescriptor;
}

export interface CapabilityCatalog {
  list(): readonly CapabilityCatalogEntry[];
  get(capabilityId: string, version?: string): CapabilityCatalogEntry;
  refresh(): Promise<void>;
}
```

Runtime descriptors are main-to-utility only and must never be included in renderer DTO projections.

- [ ] **Step 1: Write failing composed catalog tests**

Start with bundled URL Fetch and one installed Web Search pointer. Assert list order is deterministic, Web Search appears once from npm, ID/tool collisions fail, and DTO JSON contains no runtime descriptor/path/entry.

Update existing catalog expectations from:

```ts
["agentic-worktrees.url-fetch", "agentic-worktrees.web-search"]
```

to bundled-only:

```ts
["agentic-worktrees.url-fetch"]
```

and composed:

```ts
["agentic-worktrees.url-fetch", "agentic-worktrees.web-search"]
```

- [ ] **Step 2: Run catalog tests and verify failure**

Run:

```bash
npm test -- src/main/capabilities/catalog.test.ts src/main/capabilities/installed-catalog.test.ts
```

Expected: FAIL because Web Search is still statically bundled and there is no composition.

- [ ] **Step 3: Remove Web Search static imports and inject the composed catalog**

Delete Web Search imports/entries from `catalog.ts` and `host-registry.ts`; keep URL Fetch bundled. Convert `CapabilityService` and `CapabilityHostManager` from `getBundledCapability()` calls to injected `CapabilityCatalog.get()`. Update `src/main.ts` construction so repository, layout, installed catalog, composed catalog, hosts, Capability service, and distribution service share one catalog instance.

- [ ] **Step 4: Write failing runtime descriptor protocol and loader tests**

Assert host messages accept no more than 100 validated descriptors, managed roots must be main-derived, and host loader:

- loads URL Fetch from the static registry;
- hashes and imports installed Web Search from a temporary managed root;
- compares static/runtime descriptor, ID, version, and digest;
- rejects path escape, tampering, duplicate tools, and unknown IDs;
- reuses one loaded definition per `(Capability ID, version, digest)` within a host.

- [ ] **Step 5: Implement asynchronous host-only loading**

Change host server registry signature to:

```ts
interface CapabilityRuntimeRegistry {
  get(descriptor: CapabilityRuntimeDescriptor): Promise<CapabilityDefinition | undefined>;
}
```

`host.initialize` and `host.capabilities.set` carry runtime descriptors rather than IDs. Main manager obtains descriptors from the injected catalog. The utility host repeats root containment, digest, definition, and static/runtime checks before exposing tools. Preserve loopback binding, bearer authentication, secret declaration checks, timeout, cancellation, and output limiting.

- [ ] **Step 6: Run host and service verification**

Run:

```bash
npm test -- src/main/capabilities/catalog.test.ts src/main/capabilities/host-protocol.test.ts src/main/capabilities/host-registry.test.ts src/main/capabilities/capability-host-server.test.ts src/main/capabilities/capability-host-manager.test.ts src/main/capabilities/capability-service.test.ts
npm run typecheck
npm run build:capability-host
```

Expected: bundled URL Fetch and installed Web Search both activate; no renderer-facing object contains a runtime path.

- [ ] **Step 7: Commit runtime catalog integration**

```bash
git add src/main/capabilities src/main.ts
git commit -m "feat(capabilities): load managed packages in the host"
```

---

### Task 9: Add Explicit Update, Removal, Blocking, and Rollback

**Files:**
- Modify: `src/main/capabilities/capability-package-installer.ts`
- Modify: `src/main/capabilities/capability-package-installer.test.ts`
- Modify: `src/main/capabilities/capability-distribution-service.ts`
- Modify: `src/main/capabilities/capability-distribution-service.test.ts`
- Modify: `src/main/capabilities/capability-service.ts`
- Modify: `src/main/capabilities/capability-service.test.ts`
- Modify: `src/main/capabilities/capability-repository.ts`
- Modify: `src/main/capabilities/capability-repository.test.ts`
- Modify: `src/main/packages/package-repository.ts`
- Modify: `src/main/packages/package-repository.test.ts`

**Interfaces:**
- Adds:

```ts
export interface CapabilitySessionPackageCoordinator {
  listActiveRuns(capabilityId: string): readonly string[];
  assertRunsIdle(runIds: readonly string[]): Promise<void>;
  reloadRuns(capabilityId: string, version: string): Promise<void>;
  restoreRuns(capabilityId: string, version: string): Promise<void>;
  deactivateRuns(capabilityId: string): Promise<void>;
  reactivateRuns(capabilityId: string, version: string): Promise<void>;
}

interface CapabilityUpdateCommit {
  previous: ManagedPackageInstallationRecord;
  current: ManagedPackageInstallationRecord;
}

class CapabilityPackageInstaller {
  commitUpdate(
    inspected: InspectedCapabilityPackage,
    verification: CapabilityExecutableVerification,
  ): Promise<CapabilityUpdateCommit>;
  restoreUpdate(commit: CapabilityUpdateCommit): Promise<void>;
  remove(packageName: string): Promise<ManagedPackageInstallationRecord>;
  restoreRemoval(record: ManagedPackageInstallationRecord): Promise<void>;
}

class CapabilityDistributionService {
  checkForUpdates(packageName?: string): Promise<CapabilityUpdateDto[]>;
  update(input: PackageUpdateRequest): Promise<CapabilityDetailDto>;
  remove(input: PackageRemoveRequest): Promise<void>;
}
```

- [ ] **Step 1: Write failing update transaction tests**

Cover candidate resolution, explicit confirmation, implicit downgrade rejection, exact-version downgrade acceptance only with `acceptedDowngrade: true`, release-notes projection, changed permission digest, compatible setting/default preservation, obsolete secret-reference cleanup after success, required-new-setting transition to `needs_setup` with reviewed active-chat count and transactional deactivation, active-chat idle gate, pointer swap, all eligible active runs reloaded, old package retention while referenced, and complete rollback when the second active run fails.

```ts
await expect(service.update({
  packageName: "@agentic-worktrees/web-search",
  inspectionId: "update-inspection",
  acceptedVersion: "0.2.0",
  acceptedIntegrity: "sha512-new",
  acceptedPermissionDigest: "new-permissions",
})).rejects.toMatchObject({ code: "package_update_failed" });
expect(repository.getByPackageName("@agentic-worktrees/web-search"))
  .toMatchObject({ activeVersion: "0.1.0" });
expect(sessionCoordinator.restoreRuns).toHaveBeenCalledWith(
  "agentic-worktrees.web-search",
  "0.1.0",
);
```

- [ ] **Step 2: Run update tests and verify failure**

Run:

```bash
npm test -- src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/capability-distribution-service.test.ts
```

Expected: FAIL because update APIs do not exist.

- [ ] **Step 3: Implement explicit update and blocked-version policy**

Resolve update candidates through the original package identity and Official catalog policy. Require a new inspection/acceptance tuple. Reject a downgrade unless the requested source includes an exact lower version and `acceptedDowngrade` is true; display the downgrade and its release notes before confirmation. Before pointer commit, require every affected coding agent to be between turns. Keep the old version directory until pointer, DB, catalog refresh, and every host/provider reload succeed. On any failure, restore pointer/DB/catalog and every already-reloaded run to the old version.

Revalidate existing settings against the candidate manifest. Preserve values and encrypted secret references only when their keys and types remain compatible; apply new defaults; mark `needs_setup` when a new required value is missing. If that candidate has active runs, require `acceptedActiveRunCount` to match and transactionally deactivate those runs before commit; do not reactivate them until setup is complete and the user selects the Capability again. Keep old settings and secret references until the package, DB, catalog, host, and provider update commits; remove obsolete secret references only after success.

When a signed catalog blocks the active version, project `blocked`, prevent new activation, and leave data visible. Updating to an allowed version or removing it are the only recovery actions.

- [ ] **Step 4: Write failing removal tests**

Assert removal reports affected chat count, requires `acceptedActiveRunCount`, deactivates all runs, removes pointer/record, garbage-collects unreferenced versions, and reactivates previously active runs if filesystem or DB removal fails. URL Fetch removal must fail because it is bundled.

- [ ] **Step 5: Implement transactional removal and session coordination**

Add repository queries `listSessionCapabilitiesByCapabilityId()` and transactional version/status updates. `CapabilityService` implements `CapabilitySessionPackageCoordinator` using existing activation/deactivation/host/provider rollback paths. Distribution service verifies the active-run count has not changed between review and confirmation.

- [ ] **Step 6: Run lifecycle verification**

Run:

```bash
npm test -- src/main/capabilities/capability-package-installer.test.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-service.test.ts src/main/capabilities/capability-repository.test.ts src/main/packages/package-repository.test.ts
npm run typecheck
```

Expected: update/remove happy paths and rollback paths PASS.

- [ ] **Step 7: Commit update and removal lifecycle**

```bash
git add src/main/capabilities src/main/packages/package-repository.ts src/main/packages/package-repository.test.ts
git commit -m "feat(capabilities): update and remove managed packages"
```

---

### Task 10: Migrate Existing Bundled Web Search Users

**Files:**
- Create: `src/main/capabilities/web-search-migration.ts`
- Create: `src/main/capabilities/web-search-migration.test.ts`
- Modify: `src/main/capabilities/capability-distribution-service.ts`
- Modify: `src/main/capabilities/capability-distribution-service.test.ts`
- Modify: `src/main/capabilities/capability-service.ts`
- Modify: `src/main/capabilities/capability-service.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:

```ts
export const WEB_SEARCH_MIGRATION = Object.freeze({
  capabilityId: "agentic-worktrees.web-search",
  packageName: "@agentic-worktrees/web-search",
  version: "0.1.0",
  requestedSpec: "@agentic-worktrees/web-search@0.1.0",
});

export class WebSearchMigration {
  reconcile(signal: AbortSignal): Promise<
    "not_needed" | "migrated" | "migration_pending"
  >;
  retry(signal: AbortSignal): Promise<"migrated" | "migration_pending">;
}
```

- [ ] **Step 1: Write failing migration tests**

Seed the legacy `capability_installations` row with current settings, optional secret reference, permission digest, and active sessions but no managed package record. Assert:

- an exact reviewed manifest/digest migrates without asking for duplicate consent;
- settings and secret references are byte-for-byte unchanged;
- active session rows remain present and recover after package commit;
- network failure creates `migration_pending` with no false installed state;
- changed permission digest creates `migration_pending` and requires normal review;
- a fresh database does not auto-install Web Search;
- retry is idempotent.

- [ ] **Step 2: Run migration tests and verify failure**

Run:

```bash
npm test -- src/main/capabilities/web-search-migration.test.ts
```

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement reviewed migration mapping**

Migration applies only when the legacy Capability ID, legacy version, Official package/version, static descriptor, and current permission digest exactly match `WEB_SEARCH_MIGRATION`. It uses the same acquirer, inspector, verifier, installer, and lock as a normal install. It never reads or rewrites secret values.

On offline/download failure, call `saveMigrationPending()`, preserve session associations, suppress host preparation for that Capability, and return a safe recoverable state. Run migration reconciliation after package/catalog construction but before `CapabilityService.reconcileCapabilities()`.

- [ ] **Step 4: Run migration and regression tests**

Run:

```bash
npm test -- src/main/capabilities/web-search-migration.test.ts src/main/capabilities/capability-service.test.ts src/main/capabilities/capability-repository.test.ts
npm run typecheck
```

Expected: legacy data survives success and offline failure; fresh users receive no automatic install.

- [ ] **Step 5: Commit migration**

```bash
git add src/main/capabilities/web-search-migration.ts src/main/capabilities/web-search-migration.test.ts src/main/capabilities/capability-distribution-service.ts src/main/capabilities/capability-distribution-service.test.ts src/main/capabilities/capability-service.ts src/main/capabilities/capability-service.test.ts src/main.ts
git commit -m "feat(web-search): migrate bundled installations to npm"
```

---

### Task 11: Expose One Narrow Marketplace Package API and Live Catalog Events

**Files:**
- Modify: `src/shared/ipc/channels.ts`
- Modify: `src/shared/ipc/api.ts`
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/shared/ipc/schemas.test.ts`
- Create: `src/main/ipc/marketplace-handlers.ts`
- Create: `src/main/ipc/marketplace-handlers.test.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/preload.ts`
- Create or modify: `src/preload.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Adds to `Api`:

```ts
marketplace: {
  list(): Promise<MarketplaceItemDto[]>;
  inspect(request: PackageInspectRequest): Promise<CapabilityPackageInspectionDto>;
  install(request: PackageInstallRequest): Promise<CapabilityDetailDto>;
  checkUpdates(request?: { packageName?: string }): Promise<CapabilityUpdateDto[]>;
  update(request: PackageUpdateRequest): Promise<CapabilityDetailDto>;
  remove(request: PackageRemoveRequest): Promise<void>;
  cancel(request: { operationId: string }): Promise<void>;
  retryPendingMigrations(): Promise<void>;
  onPackageChanged(listener: (event: CapabilityDistributionProgress) => void): () => void;
}
```

Capability change events become a discriminated union:

```ts
{ scope: "session"; runId: string; capabilityId: string; state: CapabilityStateDto; updatedAt: string }
| { scope: "catalog"; capabilityId: string; change: "installed" | "updated" | "removed" | "blocked"; updatedAt: string }
```

- [ ] **Step 1: Write failing IPC schema and handler tests**

Assert every raw request is Zod-parsed, unknown fields are stripped, invalid package specs fail before the service, DTOs parse on return, and handlers never accept package paths. Assert Marketplace/package handlers are local operations and are not wrapped by GitHub authentication.

- [ ] **Step 2: Run IPC tests and verify failure**

Run:

```bash
npm test -- src/shared/ipc/schemas.test.ts src/main/ipc/marketplace-handlers.test.ts src/preload.test.ts
```

Expected: FAIL because Marketplace package channels and API are absent.

- [ ] **Step 3: Implement centralized channels, API, preload, and handlers**

Add capability-specific channel names under `marketplace:*`; do not create a generic arbitrary command channel. `createMarketplaceHandlers(distributionService, skillService)` delegates business logic and returns validated DTOs. Keep local Skill import behavior as a separate typed operation.

Remove `requireAuthenticated` from local Capability/Skill/Marketplace handlers; GitHub authentication remains required only for GitHub-backed actions.

- [ ] **Step 4: Broadcast catalog and operation events**

Main process validates each event before broadcasting. Session events refresh only matching chat state; catalog events refresh all open Capability pickers and Marketplace views. Package progress events contain no source paths.

- [ ] **Step 5: Run IPC verification**

Run:

```bash
npm test -- src/shared/ipc/schemas.test.ts src/main/ipc/marketplace-handlers.test.ts src/preload.test.ts src/renderer/features/capabilities/hooks/useCapabilities.test.tsx
npm run typecheck
```

Expected: tests PASS and event subscribers unsubscribe cleanly.

- [ ] **Step 6: Commit the package IPC surface**

```bash
git add src/shared/ipc src/main/ipc src/preload.ts src/preload.test.ts src/main.ts src/renderer/features/capabilities/hooks/useCapabilities.test.tsx
git commit -m "feat(ipc): expose managed capability lifecycle"
```

---

### Task 12: Build the Approved Marketplace Ecosystem Index

**Files:**
- Create: `src/renderer/features/marketplace/components/MarketplaceCapabilityDetail.tsx`
- Create: `src/renderer/features/marketplace/components/MarketplaceCapabilityDetail.test.tsx`
- Create: `src/renderer/features/marketplace/components/PackageProgress.tsx`
- Create: `src/renderer/features/marketplace/components/PackageProgress.test.tsx`
- Modify: `src/renderer/features/marketplace/hooks/useMarketplace.ts`
- Modify: `src/renderer/features/marketplace/hooks/useMarketplace.test.tsx`
- Modify: `src/renderer/pages/Marketplace.tsx`
- Modify: `src/renderer/pages/Marketplace.test.tsx`
- Modify: `src/renderer/features/capabilities/components/CapabilityPicker.tsx`
- Modify: `src/renderer/features/capabilities/components/CapabilityPicker.test.tsx`
- Modify: `src/renderer/features/capabilities/components/CapabilityDetail.tsx`
- Create: `src/renderer/features/capabilities/components/CapabilityDetail.test.tsx`

**Interfaces:**
- Consumes: `window.api.marketplace` from Task 11 and existing setup/activation APIs.
- Produces hook actions:

```ts
interface UseMarketplaceResult {
  items: MarketplaceItemDto[];
  selected?: MarketplaceItemDto;
  detail?: CapabilityDetailDto | SkillDetailDto;
  inspection?: CapabilityPackageInspectionDto;
  progress?: CapabilityDistributionProgress;
  filter: "all" | "capability" | "skill" | "installed";
  query: string;
  loading: boolean;
  error?: string;
  setFilter(value: "all" | "capability" | "skill" | "installed"): void;
  setQuery(value: string): void;
  select(item: MarketplaceItemDto): Promise<void>;
  inspectPackage(sourceSpec: string): Promise<void>;
  installCapability(): Promise<void>;
  updateCapability(): Promise<void>;
  removeCapability(): Promise<void>;
  cancelOperation(): Promise<void>;
}
```

- [ ] **Step 1: Write failing hook tests**

Cover Official list loading, automatic data-only inspection when an available Official item is selected, exact npm-spec detection, Community inspection, explicit install acceptance tuple, operation event updates, catalog refresh, removal with the reviewed active-chat count, online migration retry, stale request suppression, and safe user-facing errors.

```ts
fireEvent.change(screen.getByLabelText("Search Official items or enter an npm package"), {
  target: { value: "@community/search@1.0.0" },
});
fireEvent.click(screen.getByRole("button", { name: "Inspect package" }));
await waitFor(() => expect(api.marketplace.inspect).toHaveBeenCalledWith({
  sourceSpec: "@community/search@1.0.0",
}));
```

- [ ] **Step 2: Run hook tests and verify failure**

Run:

```bash
npm test -- src/renderer/features/marketplace/hooks/useMarketplace.test.tsx
```

Expected: FAIL because the hook still aggregates local Capability and Skill APIs and has no package actions.

- [ ] **Step 3: Implement the Marketplace state machine**

Use one reducer with states `loading`, `ready`, `inspecting`, `review`, `installing`, `updating`, `removing`, and `error`. Subscribe once to package and catalog events. Add one `online` listener that calls `retryPendingMigrations()` and remove it on unmount. Never store an executable path or secret.

- [ ] **Step 4: Write failing component/page accessibility tests**

Assert:

- heading “Marketplace” and technical subtitle;
- combined field label/placeholder exactly “Search Official items or enter an npm package”;
- filters All, Capabilities, Skills, Installed;
- Official and Community badges;
- Community arbitrary-code warning text from the spec;
- resolved package/version/integrity and permission ledger;
- progress stages Resolving, Downloading, Verifying, Installing;
- primary actions Install capability, Update capability, Remove capability;
- local Skill import remains available as a secondary action;
- Enter submits exact package inspection;
- Escape/cancel returns focus to the initiating control;
- no “Try now” or “See what it does” text;
- loading, offline fallback, empty, incompatible, blocked, migration pending, failed, and installed states.

- [ ] **Step 5: Implement the Ecosystem Index UI**

Keep the existing route and AppShell. Use the approved dense two-pane index: compact header, source/search field and filters, labeled list sections, and metadata detail pane. Reuse `Button`, `Input`, `Badge`, existing permission labels, and setup components. Extract only Marketplace-specific detail and progress components; do not redesign chat or add a dashboard.

After successful installation, leave the detail in `Installed` state with no post-install CTA or celebratory toast. Capability selection remains in chat.

- [ ] **Step 6: Update chat picker states**

Show installed/ready/needs-setup Capabilities only. Treat `blocked`, `invalid`, `incompatible`, and `migration_pending` as disabled with concise hints. Verify installed Web Search is immediately selectable as keyless `ready`; selecting any `needs_setup` Capability opens the existing setup dialog. A catalog-change event must refresh every mounted picker; no polling or timer.

- [ ] **Step 7: Run renderer verification**

Run:

```bash
npm test -- src/renderer/features/marketplace/hooks/useMarketplace.test.tsx src/renderer/features/marketplace/components/MarketplaceCapabilityDetail.test.tsx src/renderer/features/marketplace/components/PackageProgress.test.tsx src/renderer/pages/Marketplace.test.tsx src/renderer/features/capabilities/components/CapabilityPicker.test.tsx src/renderer/features/capabilities/components/CapabilityDetail.test.tsx
npm run typecheck
npm run lint
npm run package
```

Expected: tests/build PASS with keyboard and state coverage.

- [ ] **Step 8: Commit Marketplace UI**

```bash
git add src/renderer/features/marketplace src/renderer/features/capabilities/components src/renderer/pages/Marketplace.tsx src/renderer/pages/Marketplace.test.tsx
git commit -m "feat(marketplace): install npm capabilities from the index"
```

---

### Task 13: Add Packaged-Executable CLI Mode with Single-Instance Forwarding

**Files:**
- Create: `src/main/cli/arguments.ts`
- Create: `src/main/cli/arguments.test.ts`
- Create: `src/main/cli/terminal-ui.ts`
- Create: `src/main/cli/terminal-ui.test.ts`
- Create: `src/main/cli/command-protocol.ts`
- Create: `src/main/cli/command-protocol.test.ts`
- Create: `src/main/cli/command-coordinator.ts`
- Create: `src/main/cli/command-coordinator.test.ts`
- Create: `src/main/cli/run-command.ts`
- Create: `src/main/cli/run-command.test.ts`
- Create: `src/main/application-services.ts`
- Create: `src/main/application-bootstrap.ts`
- Create: `src/main/application-bootstrap.test.ts`
- Modify: `src/main.ts`
- Modify: `forge.config.ts`

**Interfaces:**
- Produces command grammar:

```ts
type PackageCliCommand =
  | { kind: "install"; sourceSpec: string }
  | { kind: "list" }
  | { kind: "update"; sourceSpec?: string }
  | { kind: "remove"; sourceSpec: string };

export function parseCliArguments(argv: readonly string[]):
  | { mode: "ui" }
  | { mode: "cli"; command: PackageCliCommand };

export interface CliTerminal {
  writeLine(value: string): void;
  confirm(question: string): Promise<boolean>;
  setExitCode(code: number): void;
}
```

Application bootstrap exposes these exact seams:

```ts
export interface ApplicationServices {
  capabilityService: CapabilityService;
  distributionService: CapabilityDistributionService;
  webSearchMigration: WebSearchMigration;
  skillService?: SkillService;
  stop(): Promise<void>;
}

export function createApplicationServices(input: {
  userDataPath: string;
  mode: "ui" | "cli";
}): Promise<ApplicationServices>;

export interface ElectronAppPort {
  whenReady(): Promise<void>;
  requestSingleInstanceLock(additionalData?: Record<string, unknown>): boolean;
  onSecondInstance(listener: (additionalData: unknown) => void): () => void;
  getPath(name: "userData" | "temp"): string;
  quit(): void;
}

export function runApplicationBootstrap(
  argv: readonly string[],
  electronApp: ElectronAppPort,
): Promise<void>;
```

Local forwarding uses newline-delimited JSON messages with schema version 1, a random 32-byte token, request ID, validated command/review responses, progress, result, and safe error. The endpoint is a random Unix socket under `app.getPath("temp")` or Windows named pipe; its name and token are passed only through Electron `additionalData`.

- [ ] **Step 1: Write failing parser and terminal tests**

Assert exact grammar and rejection:

```ts
expect(parseCliArguments(["install", "@agentic-worktrees/web-search@0.1.0"]))
  .toEqual({ mode: "cli", command: {
    kind: "install",
    sourceSpec: "@agentic-worktrees/web-search@0.1.0",
  }});
expect(parseCliArguments(["list"]))
  .toEqual({ mode: "cli", command: { kind: "list" } });
expect(() => parseCliArguments(["install"]))
  .toThrow("Usage");
```

Test confirmation defaults to false on empty input/EOF, Community warning output, four progress labels, success copy “Installed Web Search. It is now available in every chat.”, safe errors, and non-zero exit codes.

- [ ] **Step 2: Run parser/terminal tests and verify failure**

Run:

```bash
npm test -- src/main/cli/arguments.test.ts src/main/cli/terminal-ui.test.ts
```

Expected: FAIL because CLI modules do not exist.

- [ ] **Step 3: Implement shared command execution**

`runPackageCommand(command, services, terminal)` must:

- inspect before install/update;
- print package name, exact version, trust/review status, coding-agent compatibility, permissions, and Community warning;
- ask `Install this capability? (y/N)`, `Update this capability? (y/N)`, or `Remove this capability? (y/N)`;
- call the same `CapabilityDistributionService` methods as Marketplace;
- subscribe to operation progress for the command duration;
- print stable safe errors and set exit code 1 on failure, 2 on usage error, and 130 on cancellation;
- never activate a Capability or focus/create a renderer window.

- [ ] **Step 4: Write failing protocol/coordinator tests**

Test strict NDJSON framing, 1 MiB line limit, token mismatch, malformed messages, disconnect cancellation, primary process success, secondary forwarding, and simultaneous CLI/Marketplace lock serialization. Use fake `net.Server`/`net.Socket` adapters and fake Electron single-instance adapters; do not spawn a real app in unit tests.

- [ ] **Step 5: Implement primary/secondary coordination**

Before `app.whenReady()`:

1. parse CLI mode;
2. if UI mode, request the normal single-instance lock;
3. if CLI mode, create an authenticated one-use reply endpoint;
4. call `app.requestSingleInstanceLock({ schemaVersion: 1, requestId, endpoint, token, command })`;
5. if lock fails, wait for the primary to connect, stream review/progress/result, then quit;
6. if lock succeeds, initialize application services without a BrowserWindow, execute locally, close services, and quit;
7. in the long-running UI primary, handle `second-instance` by validating `additionalData`, connecting to the one-use endpoint, and executing against existing services.

The primary never trusts command data until Zod parsing succeeds. Delete Unix socket files and close all handles on every exit path.

- [ ] **Step 6: Refactor bootstrap without changing UI behavior**

Move service construction to `createApplicationServices({ userDataPath, mode })` and mode orchestration to `runApplicationBootstrap()`. Keep window creation, GitHub initialization, agent discovery, process ownership cleanup, and macOS activation behavior unchanged in UI mode. CLI mode initializes database, catalog, packages, credentials, hosts, and distribution only; it does not initialize GitHub auth, coding-agent discovery, IPC handlers, renderer, or terminal workspaces.

- [ ] **Step 7: Run CLI and bootstrap verification**

Run:

```bash
npm test -- src/main/cli src/main/application-bootstrap.test.ts
npm run typecheck
npm run lint
npm run package
```

Then invoke the packaged executable directly from the generated platform bundle:

```bash
./out/agentic-worktrees-darwin-*/agentic-worktrees.app/Contents/MacOS/agentic-worktrees list
```

On Windows, invoke `out/agentic-worktrees-win32-x64/agentic-worktrees.exe list`; on Linux x64, invoke `out/agentic-worktrees-linux-x64/agentic-worktrees list`. Expected: a table or “No managed packages installed.”, no BrowserWindow, and exit code 0.

- [ ] **Step 8: Commit CLI coordination**

```bash
git add src/main/cli src/main/application-services.ts src/main/application-bootstrap.ts src/main/application-bootstrap.test.ts src/main.ts forge.config.ts
git commit -m "feat(cli): coordinate package commands with Electron"
```

---

### Task 14: Verify Real Installation, Update, Removal, Migration, and Release Readiness

**Files:**
- Modify: `scripts/capability-smoke/driver.mjs`
- Modify: `scripts/capability-smoke/run.mjs`
- Modify: `scripts/capability-smoke/web-search-scenario.mjs`
- Modify: `scripts/capability-smoke/driver.test.ts`
- Modify: `scripts/capability-smoke/run.test.ts`
- Modify: `scripts/capability-smoke/web-search-scenario.test.ts`
- Modify: `docs/capabilities/authoring-capabilities.md`
- Modify: `README.md`
- Create: `docs/capabilities/publishing-official-capabilities.md`
- Modify: `package.json`
- Modify: `package-lock.json` only if final script/dependency normalization changes it

**Interfaces:**
- Consumes all previous tasks.
- Produces deterministic package smoke fixtures, opt-in real-provider smoke, and release instructions.

- [ ] **Step 1: Write failing smoke-harness tests**

Change the Web Search scenario fixture so it starts with no installed Web Search, installs a locally packed tarball through `CapabilityDistributionService`, then configures/activates it. Assert both Codex and OpenCode paths discover `web_search` after install and no longer depend on a bundled registry import.

Add deterministic update fixtures `0.1.0` and `0.1.1`, a failed-verifier fixture, and an offline migration fixture. Verify install, restart persistence, update rollback, removal, and migration recovery without public network or real agents.

- [ ] **Step 2: Run smoke-harness tests and verify failure**

Run:

```bash
npm test -- scripts/capability-smoke
```

Expected: FAIL because the harness still assumes bundled Web Search.

- [ ] **Step 3: Update smoke harness and scripts**

Add scripts:

```json
{
  "package:capabilities": "npm run build --workspace @agentic-worktrees/capability-sdk && npm run build --workspace @agentic-worktrees/web-search",
  "verify:capability-packages": "npm test -- scripts/package-contract/package-contract.test.ts",
  "smoke:capabilities:web-search": "node scripts/capability-smoke/run.mjs --scenario web-search"
}
```

The real scenario creates an isolated Electron user-data directory, installs the packed package through the packaged app CLI, configures through typed backend seams, activates in Codex/OpenCode, invokes `web_search`, and inspects redacted logs.

- [ ] **Step 4: Document author and user workflows**

`authoring-capabilities.md` must include the exact `package.json` metadata, `capability.json` descriptor shape, self-contained build rule, no-lifecycle-script rule, static/runtime parity test, `npm pack` check, trust labels, and compatibility rules.

`README.md` must document Marketplace flow and packaged executable commands:

```text
agentic-worktrees install @agentic-worktrees/web-search
agentic-worktrees list
agentic-worktrees update @agentic-worktrees/web-search
agentic-worktrees remove @agentic-worktrees/web-search
```

`publishing-official-capabilities.md` must require npm organization ownership, npm 2FA, trusted-publishing provenance when release automation is configured, exact version agreement, clean pack contents, full verification, catalog payload update, offline-safe fallback update, Ed25519 signing from a secret manager, and signed-envelope deployment.

- [ ] **Step 5: Run deterministic full verification**

Run in this order:

```bash
npm run typecheck
npm run lint
npm test
npm run package:capabilities
npm run verify:capability-packages
npm run build:capability-host
npm run package
```

Expected: every command exits 0.

- [ ] **Step 6: Run packaged-app smoke tests**

Using the packaged app and isolated user-data directory:

1. Marketplace install local-registry Web Search fixture;
2. confirm it appears in every open picker but is inactive;
3. keyless Codex invocation;
4. remove and CLI reinstall;
5. keyless OpenCode invocation;
6. optional encrypted Exa key path;
7. update `0.1.0` to `0.1.1` preserving settings;
8. inject failed update and confirm `0.1.0` rollback;
9. remove while active and confirm safe deactivation;
10. migrate seeded bundled records offline, reconnect, and confirm recovery;
11. inspect renderer payloads and logs for secrets, query text, fetched content, managed paths, and tokens.

Expected: every scenario passes and sensitive values are absent.

- [ ] **Step 7: Review release artifacts without publishing**

Run:

```bash
npm pack --json --dry-run --workspace @agentic-worktrees/capability-sdk
npm pack --json --dry-run --workspace @agentic-worktrees/web-search
```

Verify package names, exact `0.1.0` versions, licenses, README files, entry exports, and file lists. Verify npm organization ownership and target registry with the release operator. Do not execute `npm publish` during ordinary implementation.

- [ ] **Step 8: Publish only after explicit release authorization**

After the human confirms npm credentials, organization ownership, versions, registry, and signed catalog deployment, run:

```bash
npm publish --access public --workspace @agentic-worktrees/capability-sdk
npm publish --access public --workspace @agentic-worktrees/web-search
AGENTIC_WORKTREES_CATALOG_PRIVATE_KEY="$(security find-generic-password -w -s agentic-worktrees-catalog-signing-key)" npm run catalog:sign
```

Upload `catalog/official-capabilities.envelope.json` to the configured catalog URL, fetch it through `OfficialCatalogService`, then install the public package from a clean packaged app profile using both Marketplace and CLI. Never print or commit the signing key.

- [ ] **Step 9: Run final diagnostics and inspect scope**

Run:

```bash
npm run typecheck
npm run lint
npm test
git diff --check
git status --short
```

Use `lens_diagnostics mode=all` for every edited source file. Confirm no `.env`, signing key, tarball, user-data database, logs, smoke workspace, coverage, `dist`, `.vite`, or `out` artifacts are staged.

- [ ] **Step 10: Commit verification and documentation**

```bash
git add scripts/capability-smoke docs/capabilities README.md package.json package-lock.json
git commit -m "docs(capabilities): document npm release and verification"
```

---

## Final Acceptance Checklist

- [ ] `@agentic-worktrees/capability-sdk` packs compiled ESM and declarations for an external consumer.
- [ ] `@agentic-worktrees/web-search` packs `capability.json` and a self-contained runtime entry with no source maps or source files.
- [ ] Fresh desktop bundles contain no executable Web Search implementation or static Web Search host import.
- [ ] Signed remote catalog verification fails closed to the bundled fallback.
- [ ] Official and exact Community npm packages use the same acquisition and transaction path.
- [ ] Community review happens before executable import and clearly states arbitrary-code risk.
- [ ] Marketplace and CLI reach identical persisted package, configuration, and session state.
- [ ] CLI mode works with the app open or closed and never opens/focuses a renderer window.
- [ ] Installation refreshes every open Capability picker and never activates Web Search automatically.
- [ ] Web Search remains keyless by default and preserves optional encrypted Exa credentials.
- [ ] Update permission changes require new acceptance; failed updates restore package pointer, DB state, hosts, providers, and active session versions.
- [ ] Removal deactivates affected chats safely and never removes bundled URL Fetch.
- [ ] Existing bundled Web Search records migrate without losing settings, secret references, consent, or chat associations.
- [ ] Offline migration is visibly recoverable as `migration_pending` and retries on connectivity return.
- [ ] Blocked versions cannot be newly activated.
- [ ] Renderer DTOs/events and logs expose no executable paths, secrets, tokens, query text, or fetched result content.
- [ ] Marketplace has no “Try now” or “See what it does” action.
- [ ] Focused tests, full tests, typecheck, lint, package builds, Capability Host build, and Electron package pass.
