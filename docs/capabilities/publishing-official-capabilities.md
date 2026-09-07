# Publishing official capabilities

This is a release-operator checklist, not an automated publishing instruction. Ordinary development stops after dry-run verification. Do not publish, create production signing keys, or sign/deploy a catalog envelope without explicit release authorization.

## Prerequisites

- Confirm control of the `@agentic-worktrees` npm organization and the intended target registry.
- Require npm two-factor authentication. When release automation is configured, use npm trusted publishing with provenance instead of long-lived npm tokens.
- Obtain human approval for package versions, registry, catalog deployment, and rollback plan.
- Keep the Ed25519 catalog private key in an approved secret manager. Never generate it in a task workspace, pass it in command arguments, print it, or commit it.

## Package readiness

1. Confirm `package.json`, runtime manifest, `capability.json`, release notes, and catalog all use the exact same version.
2. Confirm the runtime bundle is static and self-contained, has no source maps or source files, and imports no undeclared/local workspace dependency.
3. Confirm package lifecycle scripts are absent. Acquisition must disable lifecycle scripts regardless.
4. Verify static/runtime descriptor and tool parity, SDK/app compatibility, permission digest, and license/provenance notices.
5. Run:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run package:capabilities
   npm run verify:capability-packages
   npm run build:capability-host
   npm run package
   npm pack --json --dry-run --workspace @agentic-worktrees/capability-sdk
   npm pack --json --dry-run --workspace @agentic-worktrees/web-search
   ```

6. Inspect both dry-run manifests for exact names and versions, README, licenses, exports, declarations where applicable, static descriptor, and executable entry. Confirm no tarball, credentials, keys, databases, user data, logs, coverage, source maps, or source files remain in the repository.
7. Run deterministic local lifecycle smoke tests. Run packaged real-provider smoke only with an isolated user-data directory and explicitly approved, already authenticated providers.

## Catalog readiness

- Update the catalog release payload and immutable integrity/content digests only from reviewed pack output.
- Update and test the bundled trusted fallback so first run and offline startup remain safe. Network failure must retain a valid fallback; it must never bypass signature or expiry checks on remote data.
- Verify install/update/remove/migration through Marketplace and CLI, including consent, restart persistence, rollback, settings and encrypted secret-reference preservation, inactive picker behavior, and reconnect recovery.
- Review renderer payloads and logs for package paths, tokens, secret references/values, queries, and fetched content.

## Authorized release only

After a release operator explicitly confirms npm ownership, 2FA/trusted-publishing configuration, versions, registry, pack contents, and catalog deployment:

1. Publish the reviewed packages using the approved npm release environment.
2. Build the canonical catalog payload from the published immutable package metadata.
3. Ask the secret manager-backed signing job to create the Ed25519 signed envelope. The private key must never enter the repository, renderer, logs, or command output.
4. Deploy the signed envelope to the configured catalog endpoint.
5. Fetch it through `OfficialCatalogService`, verify the signature and fallback behavior, then install from a clean isolated packaged-app profile through both Marketplace and CLI.
6. Record package URLs, integrity values, signed-envelope digest, test evidence, operator approval, and rollback instructions in the release record.

Publishing and signing commands are intentionally omitted from this development guide to prevent an ordinary verification run from becoming a release action.
