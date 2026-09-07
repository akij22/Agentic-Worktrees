# Authoring installable capabilities

Agentic Worktrees capabilities are npm packages containing reviewed static metadata and executable JavaScript. Installing one runs arbitrary code in the isolated Capability Host; a **Community** trust label is not an endorsement. Review the publisher, source, permissions, and package contents before accepting it. **Official** means the package and descriptor were verified by the signed Agentic Worktrees catalog, not that execution is risk-free.

## Package contract

Create a package with exact metadata like this (substitute your scope and names):

```json
{
  "name": "@example/echo-text",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": "./dist/index.js",
  "files": ["dist", "capability.json", "README.md", "LICENSE"],
  "keywords": ["agentic-worktrees-capability"],
  "agenticWorktrees": {
    "kind": "capability",
    "manifest": "./capability.json",
    "entry": "./dist/index.js"
  },
  "publishConfig": { "access": "public" }
}
```

Do not define `preinstall`, `install`, or `postinstall` lifecycle scripts. Agentic Worktrees acquires packages with lifecycle scripts disabled and rejects packages whose static contract is unsafe. Runtime dependencies must be bundled into `dist/index.js`: the installed entry is self-contained and must not import the SDK, source files, absolute paths, Electron, the renderer, database code, or coding-agent internals.

## Static descriptor

`capability.json` is read and validated **before executable import**. It contains the same manifest fields exported by the runtime entry:

```json
{
  "id": "example.echo-text",
  "name": "Echo Text",
  "version": "0.1.0",
  "sdkVersion": "^0.1.0",
  "description": "Echo validated text.",
  "category": "utility",
  "author": { "name": "Example Publisher" },
  "license": "MIT",
  "compatibility": { "codex": "supported", "opencode": "supported" },
  "permissions": { "network": [], "secrets": [] },
  "settings": {}
}
```

IDs are stable lowercase dotted identifiers; tool names are lowercase snake case. Declare the maximum network hosts and kebab-case secret permissions. Compatibility may be marked supported only after packaged Codex and OpenCode verification. A version or permission change produces a new consent digest. Static/runtime ID, version, permissions, settings, compatibility, and tools must remain in parity; add a test that imports the built entry and compares it with the descriptor.

Capabilities use JSON-Schema tool inputs, honor `AbortSignal`, return bounded output, and emit stable errors. Inject transports for tests. Never log queries, fetched content, bearer headers, tokens, local managed paths, or decrypted secrets. Secret values are supplied by the main process from encrypted storage and must not be persisted by a capability.

## Local checks

All tests below are local and must not require a registry, provider, credential, or public network:

```bash
npm run package:capabilities
npm run verify:capability-packages
npm pack --json --dry-run --workspace @example/echo-text
npm run typecheck
npm run lint
npm test
npm run build:capability-host
npm run package
```

Inspect the dry-run file list. It must include `package.json`, `capability.json`, README, license, and compiled entry; it must exclude source files, source maps, credentials, logs, databases, and build debris. Use a temporary pack destination for lifecycle tests and delete the tarball afterward.

The deterministic Web Search lifecycle tests begin with no installed package and exercise local tarball install, restart persistence, settings-preserving update, verifier rollback, safe removal, offline migration recovery, provider discovery, and redaction. The real provider smoke is separately opt-in:

```bash
AW_SMOKE_EXECUTABLE=/absolute/path/to/packaged/app npm run smoke:capabilities:web-search
```

It requires already authenticated Codex 0.150.1+ and OpenCode 1.18.23+. It never initiates login. `EXA_API_KEY` is optional and must be provided only from the environment so the encrypted secret path can be checked. See [Publishing official capabilities](publishing-official-capabilities.md) for release readiness; ordinary development must not publish or sign catalog data.
