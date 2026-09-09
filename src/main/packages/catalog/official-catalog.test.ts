import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import fallback from "./official-catalog.fallback.json";
import { OfficialCatalogService, type OfficialCatalogSnapshot, type SignedCatalogEnvelope } from "./official-catalog";

const keys = generateKeyPairSync("ed25519");
const keyId = "test-key";
function bytesEnvelope(bytes: Buffer): SignedCatalogEnvelope {
  return { algorithm: "Ed25519", keyId, payload: bytes.toString("base64url"), signature: sign(null, bytes, keys.privateKey).toString("base64url") };
}
function envelope(snapshot: unknown, privateKey = keys.privateKey): SignedCatalogEnvelope {
  const bytes = Buffer.from(JSON.stringify(snapshot));
  return { ...bytesEnvelope(bytes), signature: sign(null, bytes, privateKey).toString("base64url") };
}
function snapshot(overrides: Partial<OfficialCatalogSnapshot> = {}): OfficialCatalogSnapshot {
  return { ...(fallback as OfficialCatalogSnapshot), sequence: 2, issuedAt: "2026-09-03T00:00:00.000Z", expiresAt: "2026-09-05T00:00:00.000Z", ...overrides };
}
async function service(body: unknown, options: Partial<ConstructorParameters<typeof OfficialCatalogService>[0]> = {}) {
  return new OfficialCatalogService({ endpoint: "https://example.test/catalog", publicKeys: { [keyId]: keys.publicKey }, storageRoot: await mkdtemp(join(tmpdir(), "catalog-")), now: () => new Date("2026-09-03T12:00:00.000Z"), fetchImpl: async () => new Response(JSON.stringify(body)), ...options });
}

afterEach(() => vi.useRealTimers());
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
  it("rejects malformed UTF-8, noncanonical dates, and future timestamps", async () => {
    const invalidDates = [
      snapshot({ issuedAt: "2026-09-03T00:00:00Z" }),
      snapshot({ expiresAt: "2026-09-05T00:00:00+00:00" }),
      snapshot({ issuedAt: "2026-09-04T00:00:00.000Z" }),
      snapshot({ entries: [{ ...snapshot().entries[0], updatedAt: "2026-09-03T12:00:00.001Z" }] }),
    ];
    await expect((await service(bytesEnvelope(Buffer.from([0xff])))).load({ refresh: true })).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_signature_invalid" });
    for (const value of invalidDates) await expect((await service(envelope(value))).load({ refresh: true })).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_signature_invalid" });
  });
  it("uses trusted fallback even after its release expiry", async () => {
    await expect((await service({}, { now: () => new Date("2030-01-01T00:00:00.000Z"), fetchImpl: async () => { throw new Error("offline"); } })).load({ refresh: true })).resolves.toMatchObject({ source: "fallback", snapshot: { sequence: 1 } });
  });
  it("bounds response size", async () => {
    const catalog = await service({}, { fetchImpl: async () => new Response("x".repeat(1024 * 1024 + 1)) });
    await expect(catalog.load({ refresh: true })).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_unavailable" });
  });
  it("does not commit an abort-ignoring completion after timeout", async () => {
    vi.useFakeTimers(); let finish!: (response: Response) => void;
    const root = await mkdtemp(join(tmpdir(), "catalog-timeout-"));
    const catalog = await service({}, { storageRoot: root, fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
    const loading = catalog.load({ refresh: true }); await vi.advanceTimersByTimeAsync(5_000);
    await expect(loading).resolves.toMatchObject({ source: "fallback", warningCode: "catalog_unavailable" });
    finish(new Response(JSON.stringify(envelope(snapshot({ sequence: 9 })))));
    vi.useRealTimers(); await new Promise(resolve => setTimeout(resolve, 25));
    await expect(readFile(join(root, "cache", "official-capabilities.envelope.json"), "utf8")).rejects.toThrow();
  });
  it("serializes concurrent commits so an older late refresh cannot overwrite newer data", async () => {
    const pending: Array<(response: Response) => void> = []; const root = await mkdtemp(join(tmpdir(), "catalog-concurrent-"));
    const catalog = await service({}, { storageRoot: root, fetchImpl: () => new Promise(resolve => pending.push(resolve)) });
    const older = catalog.load({ refresh: true }), newer = catalog.load({ refresh: true });
    pending[1](new Response(JSON.stringify(envelope(snapshot({ sequence: 3 }))))); await newer;
    pending[0](new Response(JSON.stringify(envelope(snapshot({ sequence: 2 }))))); await expect(older).resolves.toMatchObject({ source: "cache", snapshot: { sequence: 3 } });
    await expect(catalog.load()).resolves.toMatchObject({ snapshot: { sequence: 3 } });
  });
  it("rejects rollback and preserves the valid cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-cache-")); let body: unknown = envelope(snapshot());
    const catalog = await service(body, { storageRoot: root, fetchImpl: async () => new Response(JSON.stringify(body)) });
    await catalog.load({ refresh: true }); body = envelope(snapshot({ sequence: 1 }));
    await expect(catalog.load({ refresh: true })).resolves.toMatchObject({ source: "cache", snapshot: { sequence: 2 } });
    expect(JSON.parse(await readFile(join(root, "cache", "official-capabilities.envelope.json"), "utf8"))).toMatchObject({ payload: expect.any(String) });
  });
});
