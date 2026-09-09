import npa from "npm-package-arg";

export interface ParsedNpmSource { requestedSpec: string; packageName: string }
export function parseNpmSourceSpec(input: string): ParsedNpmSource {
	const requestedSpec = input.startsWith("npm:") ? input.slice(4) : input;
	try {
		if (!requestedSpec || requestedSpec.startsWith("npm:")) throw new Error();
		const parsed = npa(requestedSpec);
		if (parsed.type !== "tag" && parsed.type !== "version" && parsed.type !== "range") throw new Error();
		if (!parsed.name || parsed.rawSpec.startsWith("npm:")) throw new Error();
		return { requestedSpec, packageName: parsed.name };
	} catch { throw new Error("Only npm registry package sources are allowed"); }
}
