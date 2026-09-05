import { describe, expect, it, vi } from "vitest";
import { NpmPackageMetadata } from "./npm-metadata";

const name = "@example/search";
const integrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;
const version = (value: string) => ({
  name,
  version: value,
  dist: { integrity },
});
const packument = () => ({
  name,
  "dist-tags": { latest: "2.0.0", beta: "3.0.0-beta.1" },
  versions: {
    "1.0.0": version("1.0.0"),
    "2.0.0": version("2.0.0"),
    "3.0.0-beta.1": version("3.0.0-beta.1"),
  },
});
const fixture = (body: unknown = packument()) => {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(body));
  return { fetchImpl, metadata: new NpmPackageMetadata({ fetchImpl }) };
};

describe("NpmPackageMetadata", () => {
  it("resolves latest from metadata only", async () => {
    const { metadata, fetchImpl } = fixture();
    expect(await metadata.resolve(name)).toEqual({
      packageName: name,
      version: "2.0.0",
      integrity,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://registry.npmjs.org/%40example%2Fsearch",
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      headers: { accept: "application/json" },
    });
  });
  it("resolves an exact lower version without making a downgrade decision", async () => {
    expect(await fixture().metadata.resolve(`${name}@1.0.0`)).toMatchObject({
      version: "1.0.0",
    });
  });
  it("resolves a semver range", async () => {
    expect(await fixture().metadata.resolve(`${name}@^1.0.0`)).toMatchObject({
      version: "1.0.0",
    });
  });
  it("resolves an explicit prerelease tag", async () => {
    expect(await fixture().metadata.resolve(`${name}@beta`)).toMatchObject({
      version: "3.0.0-beta.1",
    });
  });
  it("does not choose prereleases for a stable range", async () => {
    expect(await fixture().metadata.resolve(`${name}@*`)).toMatchObject({
      version: "2.0.0",
    });
  });
  it("does not invent release notes from a README", async () => {
    const body = { ...packument(), readme: "not release notes" };
    expect(await fixture(body).metadata.resolve(name)).not.toHaveProperty(
      "releaseNotes",
    );
  });
  it("projects explicit version release notes", async () => {
    const body = packument();
    Object.assign(body.versions["2.0.0"], { releaseNotes: "New release" });
    expect(await fixture(body).metadata.resolve(name)).toMatchObject({
      releaseNotes: "New release",
    });
  });
  it("does not expose tarball URLs or other packument fields", async () => {
    const body = packument();
    Object.assign(body.versions["2.0.0"].dist, {
      tarball: "https://secret.invalid/private",
    });
    const result = await fixture(body).metadata.resolve(name);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(Object.isFrozen(result)).toBe(true);
  });
  it("rejects package identity mismatch", async () => {
    await expect(
      fixture({ ...packument(), name: "other" }).metadata.resolve(name),
    ).rejects.toThrow("package_manifest_invalid");
  });
  it("rejects version identity mismatch", async () => {
    const body = packument();
    body.versions["2.0.0"].version = "1.0.0";
    await expect(fixture(body).metadata.resolve(name)).rejects.toThrow(
      "package_manifest_invalid",
    );
  });
  it("rejects selected manifest name mismatch", async () => {
    const body = packument();
    body.versions["2.0.0"].name = "other";
    await expect(fixture(body).metadata.resolve(name)).rejects.toThrow(
      "package_manifest_invalid",
    );
  });
  it("rejects missing exact versions", async () => {
    await expect(fixture().metadata.resolve(`${name}@4.0.0`)).rejects.toThrow(
      "package_version_not_found",
    );
  });
  it("rejects missing tags", async () => {
    await expect(fixture().metadata.resolve(`${name}@canary`)).rejects.toThrow(
      "package_version_not_found",
    );
  });
  it("rejects a range with no matching version", async () => {
    await expect(fixture().metadata.resolve(`${name}@^9.0.0`)).rejects.toThrow(
      "package_version_not_found",
    );
  });
  it("rejects missing integrity", async () => {
    const body = packument();
    body.versions["2.0.0"].dist.integrity = "";
    await expect(fixture(body).metadata.resolve(name)).rejects.toThrow(
      "package_integrity_failed",
    );
  });
  it("rejects malformed integrity", async () => {
    const body = packument();
    body.versions["2.0.0"].dist.integrity = "secret/path";
    await expect(fixture(body).metadata.resolve(name)).rejects.toThrow(
      "package_integrity_failed",
    );
  });
  it("rejects prototype keys masquerading as versions", async () => {
    const body = packument();
    body["dist-tags"].latest = "toString";
    await expect(fixture(body).metadata.resolve(name)).rejects.toThrow(
      "package_version_not_found",
    );
  });
  it.each([
    "https://evil.invalid/pkg.tgz",
    "file:/private/pkg",
    "git+https://evil.invalid/pkg",
    "npm:other@1.0.0",
  ])("rejects non-registry source %s without fetching", async (spec) => {
    const { metadata, fetchImpl } = fixture();
    await expect(metadata.resolve(spec)).rejects.toThrow(
      "package_source_invalid",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("maps 404 to safe package-not-found", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private", { status: 404 }));
    await expect(
      new NpmPackageMetadata({ fetchImpl }).resolve(name),
    ).rejects.toThrow("package_not_found");
  });
  it("redacts transport errors including causes", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("/private/token"));
    const error = await new NpmPackageMetadata({ fetchImpl })
      .resolve(name)
      .catch((value: unknown) => value);
    expect(error).toEqual(new Error("package_download_failed"));
    expect(error).not.toHaveProperty("cause");
  });
  it("rejects oversized declared bodies before reading", async () => {
    const response = new Response("{}", {
      headers: { "content-length": "20000000" },
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(
      new NpmPackageMetadata({ fetchImpl }).resolve(name),
    ).rejects.toThrow("package_download_failed");
  });
  it("rejects oversized streamed bodies without content-length", async () => {
    const response = new Response("x".repeat(1024 * 1024 + 1));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(
      new NpmPackageMetadata({ fetchImpl }).resolve(name),
    ).rejects.toThrow("package_download_failed");
  });
  it("rejects invalid JSON without leaking input", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("/private/invalid-json"));
    await expect(
      new NpmPackageMetadata({ fetchImpl }).resolve(name),
    ).rejects.toThrow("package_download_failed");
  });
  it("times out even when an injected fetch ignores abort", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockReturnValue(new Promise(() => undefined));
      const operation = new NpmPackageMetadata({ fetchImpl }).resolve(name);
      const assertion = expect(operation).rejects.toThrow(
        "package_download_failed",
      );
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
      expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
