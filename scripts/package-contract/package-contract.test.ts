import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("published capability package contracts", () => {
  it.each([
    ["@agentic-worktrees/capability-sdk", "agentic-worktrees-capability-sdk-0.1.0.tgz", ["package/package.json", "package/README.md", "package/LICENSE", "package/dist/index.js", "package/dist/index.d.ts"]],
    ["@agentic-worktrees/web-search", "agentic-worktrees-web-search-0.1.0.tgz", ["package/package.json", "package/README.md", "package/LICENSE", "package/LICENSE.pi-web-access", "package/capability.json", "package/dist/index.js"]],
  ])("dry-runs %s with the exact release name, version, docs, licenses, and entries", async (workspace, filename, requiredFiles) => {
    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--dry-run", "--ignore-scripts", "--workspace", workspace], {
      cwd: resolve("."), maxBuffer: 10 * 1024 * 1024,
    });
    const jsonStart = stdout.lastIndexOf("\n[");
    const [result] = JSON.parse(stdout.slice(jsonStart < 0 ? 0 : jsonStart + 1)) as [{ filename: string; files: { path: string }[] }];
    expect(result.filename).toBe(filename);
    expect(result.files.map((file) => `package/${file.path}`)).toEqual(expect.arrayContaining(requiredFiles));
  }, 30_000);

  it("packs Web Search as a self-contained production artifact", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "agentic-worktrees-web-search-pack-"));
    temporaryDirectories.push(temporaryDirectory);

    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--json", "--workspace", "@agentic-worktrees/web-search", "--pack-destination", temporaryDirectory],
      { cwd: resolve("."), maxBuffer: 10 * 1024 * 1024 },
    );
    const jsonStart = stdout.lastIndexOf("\n[");
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const [{ filename }] = JSON.parse(stdout.slice(jsonStart + 1)) as [{ filename: string }];
    const tarball = join(temporaryDirectory, filename);
    const { stdout: listing } = await execFileAsync("tar", ["-tf", tarball]);
    const files = listing.trim().split("\n");

    expect(files).toEqual(expect.arrayContaining([
      "package/package.json",
      "package/capability.json",
      "package/README.md",
      "package/dist/index.js",
      "package/LICENSE",
      "package/LICENSE.pi-web-access",
    ]));
    expect(files.some((file) => file.includes("src/") || file.endsWith(".map"))).toBe(false);

    const consumerRoot = join(temporaryDirectory, "consumer");
    await mkdir(join(consumerRoot, "node_modules"), { recursive: true });
    await execFileAsync("tar", ["-xf", tarball, "-C", consumerRoot]);
    const entryPath = join(consumerRoot, "package", "dist", "index.js");
    const source = await readFile(entryPath, "utf8");
    expect(source).not.toContain("@agentic-worktrees/capability-sdk");

    const imported = await import(`${pathToFileURL(entryPath).href}?test=${Date.now()}`) as {
      default: { manifest: { id: string }; tools: readonly { name: string }[] };
    };
    expect(imported.default.manifest.id).toBe("agentic-worktrees.web-search");
    expect(imported.default.tools.map((tool) => tool.name)).toEqual(["web_search"]);
  }, 30_000);
});
