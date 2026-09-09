import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map(name => `node:${name}`)];
export default defineConfig({ build: { target: "node22", outDir: ".vite/build", emptyOutDir: false, lib: { entry: "src/main/capabilities/package-verifier-entry.ts", formats: ["cjs"], fileName: () => "capability-package-verifier.js" }, rollupOptions: { external: [...nodeBuiltins, "electron", "ajv"] } } });
