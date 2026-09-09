import npa from "npm-package-arg";
import { maxSatisfying, valid } from "semver";
import { packageNameSchema } from "../../shared/packages/schemas";

/** Discovery only: never acquires an archive or authorizes executable code. */
export interface NpmPackageVersionMetadata {
  readonly packageName: string;
  readonly version: string;
  readonly integrity: string;
  readonly releaseNotes?: string;
}

const MAX_BYTES = 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value: Record<string, unknown>, key: string): unknown =>
  Object.hasOwn(value, key) ? value[key] : undefined;

async function readPackument(response: Response): Promise<unknown> {
  if (response.status === 404) throw new Error("package_not_found");
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) > MAX_BYTES
  )
    throw new Error("package_download_failed");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("package_download_failed");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    let next = await reader.read();
    while (!next.done) {
      length += next.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("package_download_failed");
      }
      chunks.push(next.value);
      next = await reader.read();
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
  } finally {
    reader.releaseLock();
  }
}

export class NpmPackageMetadata {
  constructor(private readonly options: { fetchImpl?: typeof fetch } = {}) {}

  async resolve(sourceSpec: string): Promise<NpmPackageVersionMetadata> {
    let source: ReturnType<typeof npa>;
    try {
      source = npa(sourceSpec);
      if (!source.name || !["tag", "version", "range"].includes(source.type))
        throw new Error();
      packageNameSchema.parse(source.name);
    } catch {
      throw new Error("package_source_invalid");
    }
    const packageName = source.name;
    if (!packageName) throw new Error("package_source_invalid");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let body: unknown;
    try {
      const attempt = (async () => {
        const response = await (this.options.fetchImpl ?? fetch)(
          `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
          {
            headers: { accept: "application/json" },
            redirect: "error",
            signal: controller.signal,
          },
        );
        return readPackument(response);
      })();
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("package_download_failed"));
        }, 5000);
      });
      body = await Promise.race([attempt, deadline]);
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message === "package_not_found"
          ? "package_not_found"
          : "package_download_failed",
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    if (!record(body) || body.name !== packageName || !record(body.versions))
      throw new Error("package_manifest_invalid");
    let version: unknown;
    if (sourceSpec === packageName && record(body["dist-tags"]))
      version = own(body["dist-tags"], "latest");
    else if (source.type === "version") version = valid(source.rawSpec);
    else if (source.type === "range")
      version = maxSatisfying(
        Object.keys(body.versions).filter((key) => valid(key)),
        source.rawSpec,
      );
    else if (record(body["dist-tags"]))
      version = own(body["dist-tags"], source.rawSpec || "latest");
    if (typeof version !== "string" || !valid(version))
      throw new Error("package_version_not_found");
    const manifest = own(body.versions, version);
    if (!manifest) throw new Error("package_version_not_found");
    if (
      !record(manifest) ||
      manifest.name !== packageName ||
      manifest.version !== version
    )
      throw new Error("package_manifest_invalid");
    const integrity = record(manifest.dist)
      ? manifest.dist.integrity
      : undefined;
    // Registry metadata is untrusted; only a canonical SHA-512 digest is useful for review.
    const digest =
      typeof integrity === "string"
        ? /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)?.[1]
        : undefined;
    if (
      !digest ||
      Buffer.from(digest, "base64").length !== 64 ||
      Buffer.from(digest, "base64").toString("base64") !== digest
    )
      throw new Error("package_integrity_failed");
    return Object.freeze({
      packageName,
      version,
      integrity: integrity as string,
      ...(typeof manifest.releaseNotes === "string" &&
      manifest.releaseNotes.length <= 32_768
        ? { releaseNotes: manifest.releaseNotes }
        : {}),
    });
  }
}
