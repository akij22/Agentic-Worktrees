# @agentic-worktrees/capability-sdk

Public TypeScript contract for authoring Agentic Worktrees capabilities.

```ts
import { defineCapability, defineTool } from "@agentic-worktrees/capability-sdk";
```

A capability exports an executable definition containing a manifest and MCP-compatible tools. Distribution packages also provide a non-executable static descriptor containing the same manifest and each tool's name, description, and JSON Schema. Use `validateCapabilityStaticDescriptor()` at trust boundaries and `staticDescriptorFromDefinition()` to verify runtime parity.

Capabilities are arbitrary Node.js code running with the desktop user's access. The SDK contract and utility-process boundary are not a security sandbox.
