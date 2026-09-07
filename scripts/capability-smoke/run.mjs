import { pathToFileURL } from "node:url";
import { createElectronCapabilitySmokeDriver } from "./driver.mjs";
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

export async function runFromEnvironment(environment = process.env) {
  if (!environment.AW_SMOKE_EXECUTABLE) {
    return { skipped: true, reason: "AW_SMOKE_EXECUTABLE is not set; real-provider smoke skipped." };
  }
  const index = process.argv.indexOf("--scenario");
  const selected = index >= 0 ? [process.argv[index + 1]] : undefined;
  await runCapabilitySmokes(
    createElectronCapabilitySmokeDriver(environment.AW_SMOKE_EXECUTABLE),
    [webSearchScenario, urlFetchScenario],
    { selectedScenarioIds: selected, apiKey: environment.EXA_API_KEY || undefined },
  );
  return { skipped: false };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runFromEnvironment().then(
    (result) => console.info(result.skipped ? result.reason : "Capability smokes completed."),
    (error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; },
  );
}
