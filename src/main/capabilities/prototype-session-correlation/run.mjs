// THROWAWAY launcher: compile only this probe and repository imports, never production outputs.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(resolve('node_modules/.prototype-correlation-'));
try {
  const outfile = resolve(directory, 'probe.mjs');
  await build({ entryPoints: ['src/main/capabilities/prototype-session-correlation/probe.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@agentic-worktrees/capability-sdk': resolve('packages/capability-sdk/src/index.ts'), '@agentic-worktrees/web-search': resolve('capabilities/web-search/src/index.ts'), '@agentic-worktrees/url-fetch-capability': resolve('capabilities/url-fetch/src/index.ts') } });
  const probe = await import(pathToFileURL(outfile).href);
  await probe.main();
} finally { await rm(directory, { recursive: true, force: true }); }
