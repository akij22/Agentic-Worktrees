import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fallback from "./official-catalog.fallback.json";
import { OfficialCatalogService, type OfficialCatalogSnapshot, type SignedCatalogEnvelope } from "./official-catalog";

const keys = generateKeyPairSync("ed25519");
const keyId = "test-key";
function envelope(snapshot: unknown, privateKey = keys.privateKey): SignedCatalogEnvelope {
  const bytes = Buffer.from(JSON.stringify(snapshot));
  return { algorithm: "Ed25519", keyId, payload: bytes.toString("base64url"), signature: sign(null, bytes, privateKey).toString("base64url") };
}
function snapshot(overrides: Partial<OfficialCatalogSnapshot> = {}): OfficialCatalogSnapshot {
  return { ...(fallback as OfficialCatalogSnapshot), sequence: 2, issuedAt: "2026-09-03T00:00:00.000Z", expiresAt: "2026-09-05T00:00:00.000Z", ...overrides };
}
async function service(body: unknown, options: Partial<ConstructorParameters<typeof OfficialCatalogService>[0]> = {}) {
  return new OfficialCatalogService({ endpoint: "https://example.test/catalog", publicKeys: { [keyId]: keys.publicKey }, storageRoot: await mkdtemp(join(tmpdir(), "catalog-")), now: () => new Date("2026-09-03T12:00:00.000Z"), fetchImpl: async () => new Response(JSON.stringify(body)), ...options });
}

describe("OfficialCatalogService", () => {
  it("accepts a verified remote envelope", async () => expect((await service(envelope(snapshot()))).load({ refresh: true })).resolves.toMatchObject({ source: "remote", snapshot: { sequence: 2 } }));
  it("falls back for invalid signatures and unknown keys", async () => {
    const invalid = envelope(snapshot()); invalid.signature = Buffer.alloc(64).toString("base64url");
    await expect((await service(invalid)).load({ refresh: true })).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_signature_invalid" });
    await expect((await service({ ...envelope(snapshot()), keyId: "unknown" })).load({ refresh: true })).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_signature_invalid" });
  });
  it("rejects expiry, schema mismatch, duplicate IDs and identity mismatches", async () => {
    const cases = [
      snapshot({ expiresAt: "2026-09-03T11:00:00.000Z" }),
      { ...snapshot(), schemaVersion: 2 },
      snapshot({ entries: [...snapshot().entries, snapshot().entries[0]] }),
      snapshot({ entries: [{ ...snapshot().entries[0], packageName: "other-package" }] }),
      snapshot({ entries: [{ ...snapshot().entries[0], blockedVersions: ["0.1.0"] }] }),
    ];
    for (const value of cases) await expect((await service(envelope(value))).load({ refresh: true })).resolves.toMatchObject({ source: "fallback" });
  });
  it("rejects rollback and preserves the valid cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-cache-")); let body: unknown = envelope(snapshot());
    const catalog = await service(body, { storageRoot: root, fetchImpl: async () => new Response(JSON.stringify(body)) });
    await catalog.load({ refresh: true }); body = envelope(snapshot({ sequence: 1 }));
    await expect(catalog.load({ refresh: true })).resolves.toMatchObject({ source: "cache", snapshot: { sequence: 2 } });
    expect(JSON.parse(await readFile(join(root, "cache", "official-capabilities.envelope.json"), "utf8"))).toMatchObject({ payload: expect.any(String) });
  });
});
