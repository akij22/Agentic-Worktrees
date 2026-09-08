import { parentPort as workerParentPort } from "node:worker_threads";
import { handleCapabilityVerificationMessage } from "./package-verifier-request";

const parentPort = process.parentPort ?? workerParentPort;
if (!parentPort) throw new Error("Capability verifier requires a utility-process parent");
let handled = false;
parentPort.on("message", (event: unknown) => {
  if (handled) return;
  handled = true;
  const candidate = event && typeof event === "object" && "data" in event ? (event as { data: unknown }).data : event;
  void handleCapabilityVerificationMessage(candidate)
    .then(message => parentPort.postMessage(message))
    .finally(() => setImmediate(() => process.exit(0)));
});
