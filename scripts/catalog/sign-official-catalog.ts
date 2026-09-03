import { createPrivateKey, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SignedCatalogEnvelope } from "../../src/main/packages/catalog/official-catalog";

export interface SignOfficialCatalogOptions { inputPath: string; outputPath: string; keyId: string; privateKeyPem: string }
export async function signOfficialCatalog(options: SignOfficialCatalogOptions): Promise<void> {
  if (!options.keyId.trim()) throw new Error("A catalog signing key ID is required");
  const payload = await readFile(options.inputPath);
  JSON.parse(payload.toString("utf8"));
  const envelope: SignedCatalogEnvelope = { algorithm: "Ed25519", keyId: options.keyId, payload: payload.toString("base64url"), signature: sign(null, payload, createPrivateKey(options.privateKeyPem)).toString("base64url") };
  const output = `${JSON.stringify(envelope, null, 2)}\n`;
  if (output.includes(options.privateKeyPem.trim())) throw new Error("Refusing to expose signing key");
  await writeFile(options.outputPath, output, { mode: 0o600 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const privateKeyPem = process.env.AGENTIC_WORKTREES_CATALOG_PRIVATE_KEY;
  if (!privateKeyPem) throw new Error("AGENTIC_WORKTREES_CATALOG_PRIVATE_KEY is required");
  await signOfficialCatalog({ inputPath: resolve("catalog/official-capabilities.payload.json"), outputPath: resolve("catalog/official-capabilities.envelope.json"), keyId: process.env.AGENTIC_WORKTREES_CATALOG_KEY_ID ?? "official-v1", privateKeyPem });
}
