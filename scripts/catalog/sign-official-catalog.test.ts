import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signOfficialCatalog } from "./sign-official-catalog";

describe("signOfficialCatalog", () => {
  it("signs the exact payload bytes without exposing the private key", async () => {
    const root = await mkdtemp(join(tmpdir(), "sign-catalog-"));
    const input = join(root, "payload.json"), output = join(root, "envelope.json");
    const payload = '{"schemaVersion":1,"sequence":1,"issuedAt":"2026-09-03T00:00:00Z","expiresAt":"2027-09-03T00:00:00Z","entries":[]}\n';
    await writeFile(input, payload);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    await signOfficialCatalog({ inputPath: input, outputPath: output, keyId: "release-1", privateKeyPem: pem });
    const text = await readFile(output, "utf8"); const envelope = JSON.parse(text);
    expect(text).not.toContain(pem.trim());
    expect(Buffer.from(envelope.payload, "base64url").toString()).toBe(payload);
    expect(verify(null, Buffer.from(envelope.payload, "base64url"), publicKey, Buffer.from(envelope.signature, "base64url"))).toBe(true);
  });
  it("rejects malformed UTF-8 input before signing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sign-catalog-"));
    const input = join(root, "payload.json"), output = join(root, "envelope.json");
    await writeFile(input, Buffer.from([0xff]));
    const { privateKey } = generateKeyPairSync("ed25519");
    await expect(signOfficialCatalog({ inputPath: input, outputPath: output, keyId: "release-1", privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString() })).rejects.toThrow();
    await expect(readFile(output)).rejects.toThrow();
  });
});
