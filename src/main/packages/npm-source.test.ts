import { describe, expect, it } from "vitest";
import { parseNpmSourceSpec } from "./npm-source";

describe("parseNpmSourceSpec", () => {
	it.each([
		["pkg", "pkg"], ["pkg@1.2.3", "pkg"], ["pkg@latest", "pkg"],
		["@scope/pkg@1.0.0", "@scope/pkg"], ["npm:@agentic-worktrees/web-search@0.1.0", "@agentic-worktrees/web-search"],
	])("accepts registry spec %s", (spec, packageName) => expect(parseNpmSourceSpec(spec)).toEqual({ requestedSpec: spec.replace(/^npm:/, ""), packageName }));
	it.each(["file:../x", "../x", "https://example.com/x.tgz", "git+https://github.com/a/b", "github:a/b", "pkg@npm:other@1", "workspace:*", "npm:npm:pkg"])("rejects non-registry spec %s", spec => expect(() => parseNpmSourceSpec(spec)).toThrow("npm registry"));
});
