import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];

export default defineConfig({
  build: {
    target: "node22",
    sourcemap: false,
    minify: false,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: nodeBuiltins,
    },
  },
});
