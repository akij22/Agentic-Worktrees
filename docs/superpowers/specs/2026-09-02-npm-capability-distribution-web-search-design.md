# npm Capability Distribution and Web Search Design

**Date:** 2026-09-02
**Status:** Approved design
**Branch:** `design/npm-capability-distribution`
**Scope:** First public npm-distributed Capability, shared desktop/CLI installation lifecycle, and migration of Web Search from bundled code to `@agentic-worktrees/web-search`

## 1. Summary

Agentic Worktrees will distribute installable Capabilities through npm while preserving the desktop application as the owner of installation, trust, persistence, and runtime activation.

The first vertical slice publishes **Web Search** as `@agentic-worktrees/web-search`. A user can install it from either the Marketplace or the Agentic Worktrees CLI. Both entry points use the same lifecycle and produce one global installation record. Once installed, Web Search becomes selectable in the existing Capability picker in every chat. Installation never activates it silently in a conversation.

The design deliberately does not copy Pi's package model. It adopts the useful principles—package-based distribution, explicit source identity, install/update/remove commands, and immediate runtime discovery—while retaining Agentic Worktrees' separate Capability and Agent Skill runtimes, Electron security boundary, per-chat Capability activation, and desktop-first user experience.

## 2. Context

The current Capability platform is a complete bundled vertical slice:

- `src/main/capabilities/catalog.ts` imports reviewed manifests at build time;
- `src/main/capabilities/host-registry.ts` imports executable definitions at build time;
- `CapabilityService` manages configuration, consent, session activation, and recovery;
- the Capability Host exposes active tools to Codex and OpenCode through MCP;
- the Marketplace and chat picker expose configuration and activation;
- Web Search and URL Fetch are private workspace packages compiled into the desktop application.

The current Agent Skills runtime is intentionally separate. It securely imports textual local directories, stores them in application-owned storage, synchronizes them with provider-native discovery, and supports explicit invocation. Remote Skill distribution is deferred.

The missing layer is a package lifecycle that can acquire a package from npm, verify it, install it into application-owned storage, persist its source identity, expose it to the appropriate runtime, update it, and remove it without requiring a new desktop release.

## 3. Product decisions

The approved decisions are:

1. Use **Capability** and **Skill** as distinct user-facing item kinds. Do not introduce an umbrella term such as Add-on.
2. Marketplace and CLI are equivalent first-class installation entry points.
3. A v1 npm package contains exactly one item kind: one Capability or one Skill package, never a mixed bundle.
4. This project implements the Capability path only. npm-distributed Skills are a later project that reuses package acquisition but retains the existing Skill lifecycle.
5. npm is the only remote package source in this project. Git sources and arbitrary URLs are deferred.
6. The Marketplace shows a curated Official catalog and accepts an exact npm package spec for direct installation.
7. The Marketplace does not search the unrestricted npm registry.
8. Installed items live in a global application library.
9. An installed Capability is selectable in every chat but is not automatically active in any chat.
10. Web Search is the first npm-distributed Capability and is published as `@agentic-worktrees/web-search`.
11. The post-install flow does not add “Try now” or “See what it does” actions. Users continue through the existing chat Capability picker.
12. A direct Community Capability can be installed after an explicit warning that its executable code is not reviewed and may access the user's system with the desktop user's permissions.
13. The current process boundary is not described as a security sandbox.
14. Updates require user confirmation in v1. Permission changes always require renewed consent.
15. A normal `npm install` inside a repository does not install or import a Capability into Agentic Worktrees.

## 4. Goals

### 4.1 User goals

- Discover Official Capabilities in the desktop Marketplace.
- Install an exact Community package that is not listed in the catalog.
- Install, list, update, and remove packages from the terminal.
- Receive the same identity, compatibility, permission, progress, and error information in both entry points.
- Find an installed Capability in every chat without restarting the app.
- Select and activate an installed Capability through the existing chat flow.
- Understand whether a package is Official, Community, Local, blocked, or incompatible.
- Recover from interrupted installation or update without corrupting the existing library.

### 4.2 Platform goals

- Publish the Capability SDK as a reusable npm package.
- Install Capability packages into versioned, application-owned storage.
- Keep the Electron main process responsible for package operations and validation.
- Load external Capability code only in the dedicated Capability Host process.
- Preserve current settings, credentials, permission consent, and per-chat activation semantics.
- Reconcile changes initiated from either the desktop UI or CLI.
- Establish package and persistence contracts that a later npm Skill project can reuse without combining the two runtimes.

### 4.3 Ecosystem goals

- Prove an independent publish/install/update lifecycle with Web Search.
- Allow Official packages to evolve independently of desktop releases.
- Permit direct Community distribution without pretending that npm publication implies review.
- Leave a clear path to stronger sandboxing, publisher onboarding, and Community catalog submissions.

## 5. Non-goals

This project does not include:

- npm-distributed Skills;
- packages containing both a Capability and Skills;
- Git package sources;
- arbitrary remote archives;
- automatic scanning of project or global `node_modules`;
- project-declared Capability dependencies;
- unrestricted npm search in the Marketplace;
- ratings, download counts, reviews, or publisher profiles;
- public Community submission workflows;
- automatic updates without confirmation;
- automatic Capability activation in a chat;
- task-based Capability recommendations;
- a hostile-code sandbox;
- `Try now` or `See what it does` post-install actions;
- changes to the existing Skill invocation experience.

## 6. Terminology and state model

### 6.1 Item kinds

- **Capability:** executable package that contributes one or more agent tools through the Capability runtime.
- **Skill:** Agent Skills-compatible instructions loaded through provider-native Skill discovery.

The Marketplace can display both kinds, but their trust, setup, activation, and runtime lifecycles remain separate.

### 6.2 Package provenance

- **Built-in:** shipped inside the desktop application.
- **Official:** listed in the Agentic Worktrees Official catalog and published by an approved Agentic Worktrees publisher.
- **Community:** installed from an exact npm package spec but not reviewed by Agentic Worktrees.
- **Local:** loaded from a local development source through existing or future development tooling.

### 6.3 Global installation states

- `available`: listed but not installed;
- `installing`: acquisition or verification is in progress;
- `installed`: stored, verified, and available to the runtime;
- `needs_setup`: installed but missing required configuration;
- `update_available`: a newer eligible version exists;
- `updating`: a staged update is in progress;
- `incompatible`: the package cannot run with the current application or selected coding agent;
- `blocked`: the catalog or local policy prevents execution of this version;
- `invalid`: installation exists but verification or reconciliation failed;
- `removing`: uninstall is in progress;
- `migration_pending`: an existing bundled installation is preserved but awaits package acquisition or verification.

`active` remains a per-chat Capability state. The UI must not use `installed` and `active` interchangeably.

## 7. Package contract

### 7.1 Published packages

The vertical slice publishes:

- `@agentic-worktrees/capability-sdk`;
- `@agentic-worktrees/web-search`.

The SDK package must expose compiled JavaScript and TypeScript declarations suitable for an external consumer. Web Search must consume the published SDK contract rather than repository-only source exports.

### 7.2 Explicit Agentic Worktrees metadata

An installable package declares an explicit Agentic Worktrees manifest in `package.json`. The v1 shape is intentionally singular because one package contains one item kind:

```json
{
  "name": "@agentic-worktrees/web-search",
  "version": "0.1.0",
  "keywords": ["agentic-worktrees-capability"],
  "agenticWorktrees": {
    "kind": "capability",
    "manifest": "./capability.json",
    "entry": "./dist/index.js"
  }
}
```

`capability.json` is a static, non-executable projection of the Capability manifest. Agentic Worktrees validates and displays it before any package code is loaded. The executable entry still exports a validated Capability definition containing the same manifest. Package metadata identifies how Agentic Worktrees discovers both resources; installation succeeds only when the static manifest and runtime manifest match exactly.

Required invariants:

- npm package version equals Capability manifest version;
- package kind is exactly `capability` for this project;
- manifest and entry paths are relative, contained by the package root, and point to packaged production output;
- the static manifest is valid JSON and exactly matches the manifest exported by the runtime definition;
- the package exposes exactly one Capability definition;
- Capability ID and provided tool names remain stable identifiers;
- the package cannot choose its managed installation path;
- the executable artifact is self-contained, and any runtime dependencies are bundled into the published artifact;
- Agentic Worktrees never executes npm lifecycle scripts or runs `npm install` inside an acquired Capability package;
- development files, tests, secrets, logs, and source maps containing sensitive paths are excluded from the published artifact.

### 7.3 Version selection

Accepted source syntax initially includes:

```text
@agentic-worktrees/web-search
@agentic-worktrees/web-search@0.1.0
npm:@agentic-worktrees/web-search@0.1.0
```

An unversioned spec resolves to the current eligible release. An exact version remains pinned until the user explicitly chooses another version. Downgrades require an explicit version and a warning; an ordinary update never downgrades.

## 8. Official catalog

Agentic Worktrees owns a small remote Official catalog. It contains discovery and policy metadata, not executable code.

Each entry includes at least:

- Capability ID;
- npm package name;
- allowed version or release channel;
- display metadata needed for the Marketplace list;
- Official publisher identity;
- review status;
- minimum application version;
- blocked or revoked versions;
- last update timestamp.

The catalog is versioned and signed. The application verifies it against an app-bundled trust key before using remote data. An invalid, expired, or unverifiable response is ignored.

The desktop application ships a fallback snapshot containing enough information to display and install Web Search when the remote catalog is temporarily unavailable. Remote data may update availability, version policy, and block status, but cannot silently grant additional permissions or replace package identity.

The first catalog is curated only. Community packages do not appear automatically because they use the npm keyword. A later governance project may add reviewed Community submissions.

## 9. User experience

### 9.1 Marketplace information architecture

The existing Marketplace remains the shared surface for Capabilities and Skills. Hallmark direction:

- genre: modern-minimal;
- theme: preserve the existing dark, cool-blue design system;
- app-page macrostructure: evolve the current repeated Workbench pattern toward an **Ecosystem Index** for discovery;
- preserve the existing AppShell, typography, spacing scale, density, and chat picker;
- introduce no decorative enrichment or separate route-level navigation.

The Marketplace header contains one combined search/source field:

> Search Official items or enter an npm package

The field supports ordinary filtering of catalog items. When its value is an exact npm package spec, the primary action becomes **Inspect package**. Exact Community packages are reviewed before installation but are not added to the public catalog.

Filters remain explicit:

- All;
- Capabilities;
- Skills;
- Installed.

Official items appear in dense, labeled discovery sections rather than a uniform decorative card grid. Selecting an item opens its detail and trust panel.

### 9.2 Capability detail

Before installation, the detail view shows:

- name, description, type, and resolved version;
- provenance: Built-in, Official, Community, or Local;
- publisher and npm package;
- Codex and OpenCode compatibility;
- provided tools;
- network, secret, and other declared permissions;
- license and source repository when available;
- review status;
- one primary action: **Install capability**.

Community packages display a prominent, factual warning:

> This package contains executable code that has not been reviewed by Agentic Worktrees. It may access files, processes, credentials, and network resources available to your user account.

The confirmation applies to the exact package identity, resolved version, content integrity, and permission digest. It does not trust every package from the same publisher.

### 9.3 Installation progress

The UI reports four stable stages:

1. Resolving package;
2. Downloading package;
3. Verifying package;
4. Installing capability.

Fast operations may complete without flashing a spinner. Long operations show the current stage and remain cancellable until the atomic commit begins.

On success, the detail state becomes `Installed`. This visible state change is sufficient feedback; there is no celebratory toast or post-install CTA. The Capability picker in every chat refreshes automatically.

### 9.4 CLI experience

The initial command family is:

```text
agentic-worktrees install <npm-spec>
agentic-worktrees list
agentic-worktrees update [npm-spec]
agentic-worktrees remove <npm-spec>
```

The package declares its item kind, so users do not need separate `capability install` and `skill install` command families. In this project, the installer accepts Capability packages; the later Skill project adds the Skill route without changing command grammar.

For installation, the CLI prints the same resolved identity, trust classification, compatibility, and permissions shown by the Marketplace. Confirmation defaults to no:

```text
Install this capability? (y/N)
```

Official and Community packages both require confirmation. Community packages include the full-system-access warning. Progress remains in the terminal, and the desktop app is not brought to the foreground.

Successful completion states:

> Installed Web Search. It is now available in every chat.

The command does not activate Web Search in an existing chat.

### 9.5 Setup and chat usage

Installation and setup are separate:

- a Capability without required setup becomes `installed` immediately;
- a Capability missing required configuration becomes `needs_setup`;
- selecting `needs_setup` in a chat opens the existing setup dialog;
- after setup, the existing activation flow attaches the Capability to that chat;
- Web Search is immediately selectable because its default path is keyless; its optional Exa credential remains configurable later.

No new chat action is introduced after installation. Users select, activate, and deactivate Capabilities exactly where they do today.

### 9.6 Update and removal

The Marketplace and CLI support the same lifecycle:

- update checks resolve a candidate without changing the current installation;
- the user reviews version, changelog summary, and permission differences;
- any permission-digest change requires renewed consent;
- the new version is staged and verified before replacing the active package;
- failed updates preserve the previous version;
- uninstall warns when the Capability is active in one or more chats;
- confirmed uninstall deactivates affected chats, stops unowned hosts, removes the active projection and installation record, and preserves unrelated Skills and Capabilities.

## 10. Architecture

### 10.1 Shared package lifecycle

Introduce a package lifecycle boundary owned by the Electron main process. Its responsibilities are limited to remote package concerns:

- parse and normalize npm source specs;
- resolve registry metadata and a concrete version;
- retrieve the package artifact;
- verify registry integrity;
- extract into a controlled staging directory;
- reject unsafe archive paths and unsupported package shapes;
- read and validate Agentic Worktrees package metadata;
- return a verified staged package to a type-specific installer;
- coordinate install, update, remove, progress, cancellation, and locking;
- emit package-catalog invalidation events.

It does not configure or activate Capabilities and does not validate Skill content. Type-specific services retain those responsibilities.

### 10.2 Capability package installer

The Capability installer receives only a verified staged package. It:

- validates the static `capability.json` without loading executable code;
- compares package metadata with the static manifest;
- checks SDK and application compatibility;
- calculates permission and content digests;
- captures explicit consent from the static review surface;
- only after consent, loads and validates the executable Capability definition in a disposable verification process;
- requires the runtime manifest to match the approved static manifest exactly;
- atomically moves the package into versioned application storage;
- updates installation persistence;
- refreshes the installed Capability catalog;
- verifies that the Capability Host can discover the installed definition;
- rolls back filesystem and persistence changes if discovery fails.

### 10.3 Installed Capability catalog

Replace the assumption that every executable Capability is bundled with a composed catalog:

```text
Capability catalog
├── bundled reviewed capabilities
└── installed npm capabilities
```

The composed catalog exposes one normalized descriptor to `CapabilityService`. Existing configuration and activation behavior should not need to know whether a definition was originally bundled or installed from npm, except for provenance, trust, version, and uninstall policy.

The renderer receives metadata DTOs only. It never receives package paths, module entry points, registry credentials, or executable definitions.

### 10.4 Dynamic Capability Host registry

The Capability Host evolves from static imports to a registry built from trusted descriptors supplied by the main process. Installed executable modules are loaded only by the dedicated host process from derived paths under application-owned storage.

The host must verify again that:

- the requested Capability ID matches the loaded manifest;
- the installed version and content digest match the descriptor;
- the entry remains within the managed package root;
- only Capabilities active for the current chat expose tools;
- cancellation, timeout, secret resolution, output limits, and logging rules remain enforced.

Process isolation limits lifecycle and crash impact. It does not prevent arbitrary Node.js code from accessing the user's environment. The UI and CLI must state this accurately for Community packages.

### 10.5 CLI and desktop coordination

The Electron main process remains the single writer for package state.

- When the desktop application is running, the CLI forwards a typed package command to that instance and streams progress back to the terminal.
- When the application is closed, the CLI starts the application backend in a non-interactive command mode without opening or focusing the renderer, waits for completion, and exits.
- Electron single-instance coordination ensures that only one main-process owner handles the command.
- Marketplace actions use normal narrow IPC handlers but call the same package lifecycle service.
- Package operations use a global installation lock so CLI and Marketplace cannot concurrently mutate the library.

The CLI never edits the database, package store, or configuration directly.

## 11. Storage and persistence

Capability packages use application-owned storage conceptually equivalent to:

```text
<electron-user-data>/capabilities/
├── packages/<capability-id>/<version>/
├── active/<capability-id>/
└── .staging/<operation-id>/
```

Managed paths are derived from validated IDs and versions. They are never accepted from the renderer or CLI.

Persist at least:

- Capability ID;
- npm package name;
- requested source spec;
- resolved version;
- registry integrity;
- content digest;
- provenance kind;
- review status;
- compatibility state;
- accepted permission digest;
- installation state;
- installed and updated timestamps;
- last safe error code;
- trust-consent timestamp for Community packages.

Existing Capability settings, encrypted secret references, and per-session activation records remain separate and retain their current meaning.

## 12. Installation flows

### 12.1 Official Marketplace installation

1. Marketplace loads the Official catalog and bundled fallback.
2. User selects Web Search.
3. Main process resolves the catalog-approved npm package and version.
4. Detail view shows resolved metadata and permissions.
5. User chooses **Install capability**.
6. Package lifecycle downloads, verifies, and stages the artifact.
7. Capability installer validates the definition and compatibility.
8. User consent is persisted for the permission digest.
9. Package and installation record are committed atomically.
10. Host discovery is verified.
11. Marketplace and all open chat pickers refresh.
12. Web Search is `installed` globally and inactive in every chat until selected.

### 12.2 Direct Community installation

1. User enters an exact npm spec in the Marketplace or CLI.
2. Package lifecycle resolves and stages the package without running lifecycle scripts or loading its executable entry.
3. Package metadata and static `capability.json` are validated as data.
4. User sees Community provenance, exact version, integrity, permissions, and the arbitrary-code warning.
5. Explicit consent is required before any package code is loaded.
6. A disposable verification process loads the executable definition and requires its runtime manifest to match the approved static manifest.
7. Installation continues through the same atomic commit and host-discovery verification.
8. The installed Capability is labeled Community in every management surface.

### 12.3 Update

1. Resolve a candidate version.
2. Reject an implicit downgrade.
3. Stage and verify without touching the active version.
4. Display version and permission changes.
5. Capture renewed consent when required.
6. Atomically replace the active projection and installation metadata.
7. Reconcile active chats on their next safe activation boundary.
8. Roll back to the previous version if host discovery or agent reconfiguration fails.

### 12.4 Uninstall

1. Resolve installation by Capability ID or npm identity.
2. Show affected active chats.
3. Require confirmation.
4. Deactivate affected sessions at a safe boundary.
5. Stop unowned hosts and remove the active projection.
6. Remove package records and unreferenced package versions.
7. Emit catalog invalidation.

## 13. Web Search migration

### 13.1 Publication

The current private workspace package becomes the public package `@agentic-worktrees/web-search`. It ships compiled production output, depends on the published Capability SDK, retains Capability ID `agentic-worktrees.web-search`, and preserves the current tool contract and provenance.

The npm package name changes; the Capability ID and tool name `web_search` do not.

### 13.2 Fresh installations

A fresh Agentic Worktrees installation:

- does not contain executable Web Search code in the desktop bundle;
- displays Web Search as `available` from the Official catalog;
- installs it only after user confirmation;
- keeps URL Fetch and other currently bundled Capabilities unchanged until separately migrated.

### 13.3 Existing users

On upgrade, reconciliation detects existing Web Search installation/configuration records created when Web Search was bundled.

- Existing settings, optional encrypted credential references, permission consent, and session associations are preserved.
- The application resolves and installs the matching Official npm version.
- Existing permission consent is retained only if package identity, Capability ID, version policy, and permission digest match the reviewed migration mapping.
- If the migration needs network access while offline, records and settings remain intact in a visible `migration_pending` recovery state; installation resumes when connectivity returns.
- Web Search is not marked installed until package verification and host discovery succeed.
- Existing active-chat associations are restored only after successful package installation and provider verification.

## 14. Security and trust

### 14.1 Common protections

- npm specs are parsed as data, never interpolated into arbitrary shell commands.
- Registry responses, redirects, package size, archive entries, and extraction paths are bounded and validated.
- Integrity is verified before extraction is committed.
- Staging rejects absolute paths, traversal, symlink escapes, hard-link escapes, unexpected package roots, and entry points outside the package.
- Static manifests are validated before consent; executable definitions are loaded only after consent and validated again when loaded by the host.
- Capability installation never runs npm lifecycle scripts or arbitrary dependency installers.
- Capability packages must ship self-contained executable output.
- The renderer receives no executable paths, registry credentials, secrets, host tokens, or process handles.
- Secrets continue to resolve only through declared Capability settings.
- Errors and logs redact credentials, sensitive paths, query text, and fetched result content.

### 14.2 Official trust

Official status comes only from the Agentic Worktrees catalog and approved package identity. An npm scope or keyword alone does not grant Official status.

The catalog can block a known unsafe or incompatible version. A blocked installed version remains visible with a reason but cannot be newly activated. Recovery actions are update or uninstall.

### 14.3 Community trust

Community Capability installation is an explicit informed-risk mode. Consent must state that:

- the code is not reviewed by Agentic Worktrees;
- the Capability Host is not a hostile-code sandbox;
- declared permissions describe intended behavior but cannot technically confine arbitrary Node.js code;
- the package may access resources available to the desktop user account.

Consent is bound to package identity, resolved version, content integrity, and permission digest. Updates with changed content or permissions require review again. Agentic Worktrees must never label Community code as safe merely because it passed structural validation.

## 15. Error handling and recovery

Stable package-lifecycle errors should include:

- `package_not_found`;
- `package_version_not_found`;
- `package_source_invalid`;
- `package_integrity_failed`;
- `package_archive_invalid`;
- `package_manifest_invalid`;
- `package_kind_unsupported`;
- `package_incompatible`;
- `package_blocked`;
- `package_permission_denied`;
- `package_busy`;
- `package_download_failed`;
- `package_verification_failed`;
- `package_install_failed`;
- `package_update_failed`;
- `package_remove_failed`;
- `package_sync_failed`.

User-facing errors state what failed, preserve the prior state, and offer a concrete recovery action. Internal diagnostics retain bounded context without exposing secrets or arbitrary local paths.

Recovery rules:

- failed fresh install removes staging and creates no installed record;
- failed update keeps the prior package active;
- failed removal restores the prior projection and record when possible;
- interrupted operations are reconciled idempotently at startup;
- the app never reports `installed` until persistence and host discovery agree;
- a failed CLI operation returns a non-zero exit status and the same stable error code used by the desktop flow.

## 16. Events and synchronization

Package lifecycle events include operation ID, item kind, package identity, safe state, progress stage, and normalized error code. They contain no package paths or executable metadata.

The event stream updates:

- Marketplace list and detail;
- Capability Library views;
- every open chat Capability picker;
- CLI progress when the operation originated from the terminal.

A completed installation invalidates the composed Capability catalog. Existing in-flight agent turns are not mutated. Newly installed or updated tools become available when the user next activates the Capability or when an already-active Capability safely reconciles at the next turn boundary.

## 17. Testing strategy

### 17.1 Package contract tests

- published SDK can be installed and imported by an external fixture;
- packed Web Search contains only required production artifacts;
- package version and Capability manifest version must match;
- invalid kind, entry, ID, SDK range, permissions, and tool definitions are rejected;
- production dependencies resolve without repository workspace links.

### 17.2 Source and archive security tests

Use a fake registry and controlled tarballs for:

- scoped and unscoped specs;
- exact and unversioned releases;
- missing packages and versions;
- integrity mismatch;
- oversized metadata and archives;
- traversal, absolute paths, symlinks, hard links, duplicate entries, and malformed package roots;
- redirects and interrupted downloads;
- cancellation before commit.

### 17.3 Transaction and persistence tests

- fresh install commit;
- update with previous-version rollback;
- uninstall with active sessions;
- restart reconciliation for every transitional state;
- preservation of settings and encrypted secret references;
- concurrent Marketplace and CLI operations;
- package identity and Capability ID collision handling;
- downgrade rejection;
- blocked-version transitions.

### 17.4 Runtime tests

- composed catalog lists bundled and installed Capabilities without collision;
- Capability Host loads an installed package from managed storage;
- digest, ID, version, and entry mismatch fail closed;
- only active tools are exposed;
- timeout, cancellation, output bounds, secret access, and redaction remain intact;
- host crash does not crash Electron;
- update rollback restores a working host definition.

### 17.5 Renderer tests

- Official catalog, fallback, offline, empty, loading, incompatible, blocked, installing, installed, updating, and error states;
- exact npm package inspection;
- Official and Community trust presentations;
- keyboard navigation and visible focus;
- no post-install “Try now” or “See what it does” actions;
- automatic refresh of all open chat pickers;
- setup dialog remains deferred until chat selection when required.

### 17.6 CLI tests

- install, list, update, and remove grammar;
- confirmation defaults to no;
- Official and Community review output;
- progress and cancellation;
- structured exit codes;
- operation with app open;
- operation with app closed;
- single-instance forwarding;
- no renderer focus during terminal operations;
- parity with desktop final state.

### 17.7 Migration tests

- bundled Web Search records migrate to npm identity;
- configuration, credential references, and permission consent are preserved only on an exact reviewed match;
- offline migration preserves data and resumes later;
- existing active chats recover after successful installation;
- fresh installs do not contain bundled Web Search executable code.

### 17.8 Real smoke tests

On packaged desktop builds:

1. install Web Search from the Marketplace and use it in a real Codex chat;
2. remove it, install it from the CLI, and use it in a real OpenCode chat;
3. verify keyless search works;
4. optionally verify the encrypted Exa credential path;
5. update between two test package versions and preserve configuration;
6. remove Web Search while active and confirm safe deactivation;
7. inspect logs and renderer state for secrets, query text, result content, package paths, and tokens.

## 18. Implementation sequence

1. Define the npm package manifest contract and shared package DTOs.
2. Make `@agentic-worktrees/capability-sdk` publishable and verify it with an external consumer fixture.
3. Implement npm source resolution, download, integrity verification, safe staging, and operation locking.
4. Add package installation persistence and startup reconciliation.
5. Implement the Capability-specific package validator and atomic installer.
6. Compose bundled and installed Capability catalogs.
7. Add dynamic managed-package loading to the Capability Host and verify rollback.
8. Publish `@agentic-worktrees/web-search` and remove its executable code from the desktop bundle.
9. Implement existing-user Web Search migration.
10. Add the remote Official catalog and bundled fallback.
11. Redesign the Marketplace discovery/install states using the approved Ecosystem Index direction.
12. Add narrow preload/IPC operations and package lifecycle events.
13. Add the CLI entry point and main-process single-instance command coordination.
14. Implement update, blocked-version handling, uninstall, and Community trust renewal.
15. Run deterministic tests, packaged-app smoke tests, type checking, linting, renderer build, and desktop packaging.

Database schema changes must use generated Drizzle migrations. Generated artifacts must not be edited manually.

## 19. Acceptance criteria

The vertical slice is complete only when:

- `@agentic-worktrees/capability-sdk` and `@agentic-worktrees/web-search` are installable npm packages;
- a fresh desktop build contains no executable Web Search implementation;
- Web Search appears in the Official Marketplace catalog;
- Marketplace installation succeeds from a clean application state;
- CLI installation produces the same persisted state with the app open or closed;
- Community Capability installation requires the approved arbitrary-code warning and explicit consent;
- Web Search appears in every open chat picker immediately after installation;
- Web Search remains inactive until selected in a chat;
- keyless Web Search works in real Codex and OpenCode sessions;
- setup, optional credentials, permission consent, and per-chat activation retain current behavior;
- installation and configuration persist after application restart;
- update and uninstall are available from both Marketplace and CLI;
- failed install/update/remove operations preserve a coherent previous state;
- bundled Web Search users retain compatible settings and consent through migration;
- blocked versions cannot be newly activated;
- renderer and CLI expose no secrets, managed paths, host tokens, or raw executable definitions;
- focused tests, `npm run typecheck`, `npm run lint`, `npm test`, the renderer build, and `npm run package` pass.

## 20. Follow-up projects

### Project 2 — npm Agent Skills

Reuse source parsing, npm acquisition, staging, source identity, global locking, CLI grammar, lifecycle events, and update/remove coordination. Route verified Skill packages into the existing text-only Skill validator, managed store, repository, and provider-native discovery. Do not load Skills through the Capability Host.

### Project 3 — Public ecosystem governance

Design publisher onboarding, Community catalog submissions, review status, stronger identity, revocation policy, security response, package reporting, discovery quality, and compatibility evidence.

### Project 4 — Stronger Community isolation

Evaluate and implement an enforceable sandbox for untrusted executable Capabilities. When available, replace the v1 informed-risk warning with accurately described technical confinement. Do not claim sandbox guarantees before this project is complete.

### Deferred package capabilities

Mixed Capability/Skill bundles, project-scoped package declarations, Git sources, local linked development packages, automatic updates, recommendations, ratings, and analytics require separate approved designs.

## 21. Risks and mitigations

### Community packages have broad system access

Mitigation: explicit informed consent, exact package/version/integrity binding, visible Community labeling, no implication of sandboxing, and a dedicated stronger-isolation follow-up.

### Dynamic package loading expands the supply-chain boundary

Mitigation: explicit package manifest, registry integrity checks, controlled staging, path validation, double validation, application-owned storage, main-process ownership, and host-only execution.

### CLI and desktop could corrupt shared state

Mitigation: the main process is the single writer, Electron single-instance coordination forwards commands, and one global package-operation lock serializes mutations.

### Official catalog compromise could redirect packages

Mitigation: require a versioned signed catalog, verify it with an app-bundled trust key, bind entries to approved npm identities and version policy, preserve a bundled fallback, never let catalog data grant permissions, and require static/runtime manifest validation after download.

### Web Search migration may occur while offline

Mitigation: preserve existing settings and session records, expose a recoverable migration state, and retry installation when connectivity returns. Never claim the Capability is installed before verification succeeds.

### Package and Capability versions may drift

Mitigation: require npm package version and Capability manifest version equality and fail installation on mismatch.

### Scope may expand into a complete Marketplace ecosystem

Mitigation: keep the first plan limited to npm Capability distribution and Web Search. Skills, submissions, ratings, Git sources, mixed bundles, and strong sandboxing remain explicit follow-up projects.
