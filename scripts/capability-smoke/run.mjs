import { pathToFileURL } from "node:url";
import { createElectronCapabilitySmokeDriver } from "./driver.mjs";
import { runDeterministicLocalWebSearchSmoke } from "./local-lifecycle.mjs";
import { webSearchScenario } from "./web-search-scenario.mjs";
import { urlFetchScenario } from "./url-fetch-scenario.mjs";

const minimums = { codex: "0.150.1", opencode: "1.18.23" };

export function atLeast(actual, minimum) {
  const a = actual.match(/\d+\.\d+\.\d+/)?.[0].split(".").map(Number) ?? [];
  const b = minimum.split(".").map(Number);
  return a[0] > b[0] || a[0] === b[0] && (a[1] > b[1] || a[1] === b[1] && (a[2] ?? 0) >= b[2]);
}

export async function runCapabilitySmokes(driver, scenarios, options = {}) {
  await driver.launch();
  try {
    const agents = await driver.listConfiguredAgents();
    for (const [kind, label] of [["codex", "Codex"], ["opencode", "OpenCode"]]) {
      const found = agents.find((item) => item.kind === kind);
      if (!found || !atLeast(found.version, minimums[kind])) {
        throw new Error(`${label} CLI ${minimums[kind]} or newer is required.`);
      }
    }
    const context = {
      agents,
      worktreeId: await driver.getFirstWorktreeId(),
      timeoutMs: options.timeoutMs ?? 120000,
      apiKey: options.apiKey,
    };
    const selected = options.selectedScenarioIds ?? scenarios.map((item) => item.id);
    const results = [];
    for (const scenario of scenarios) if (selected.includes(scenario.id)) results.push(...await scenario.run(driver, context));
    const logs = driver.readProcessLogs();
    for (const marker of ["Authorization", "exaApiKey", options.apiKey].filter(Boolean)) {
      if (logs.includes(marker)) throw new Error("Sensitive capability data was found in application logs.");
    }
    return results;
  } finally {
    await driver.close();
  }
}

export async function runFromEnvironment(environment = process.env, argv = process.argv.slice(2)) {
  const scenarios = [webSearchScenario, urlFetchScenario];
  const index = argv.indexOf("--scenario");
  const requested = index >= 0 ? argv[index + 1] : undefined;
  if (index >= 0 && !requested) throw new Error("--scenario requires a scenario id.");
  if (requested && !scenarios.some((scenario) => scenario.id === requested)) throw new Error(`Unknown capability smoke scenario: ${requested}.`);

  if (!requested || requested === "web-search") await runDeterministicLocalWebSearchSmoke();
  if (!environment.AW_SMOKE_EXECUTABLE) {
    return { skipped: true, reason: "Deterministic local smoke passed; AW_SMOKE_EXECUTABLE is not set, so real-provider smoke was skipped." };
  }
  await runCapabilitySmokes(
    createElectronCapabilitySmokeDriver(environment.AW_SMOKE_EXECUTABLE),
    scenarios,
    { selectedScenarioIds: requested ? [requested] : undefined, apiKey: environment.EXA_API_KEY || undefined },
  );
  return { skipped: false };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runFromEnvironment().then(
    (result) => console.info(result.skipped ? result.reason : "Capability smokes completed."),
    (error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; },
  );
}
