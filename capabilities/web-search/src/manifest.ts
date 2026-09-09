import { validateCapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import descriptorJson from "../capability.json";

export const webSearchDescriptor = validateCapabilityStaticDescriptor(descriptorJson);
export const webSearchManifest = webSearchDescriptor.manifest;
