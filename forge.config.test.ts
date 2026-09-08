import { describe, expect, it } from 'vitest';
import packageJson from './package.json';
import { shouldIgnorePackagedPath } from './forge.config';

const nativeRuntimeDependencies = ['better-sqlite3', 'node-pty'] as const;

describe('packaged native runtime dependencies', () => {
  it.each(nativeRuntimeDependencies)(
    'keeps %s as a production dependency and in the packaged application',
    (dependency) => {
      expect(packageJson.dependencies).toHaveProperty(dependency);
      expect(shouldIgnorePackagedPath('/node_modules')).toBe(false);
      expect(shouldIgnorePackagedPath(`/node_modules/${dependency}`)).toBe(false);
      expect(
        shouldIgnorePackagedPath(`/node_modules/${dependency}/package.json`),
      ).toBe(false);
    },
  );

  it('keeps required runtime helpers without copying unrelated source files', () => {
    expect(shouldIgnorePackagedPath('/node_modules/bindings')).toBe(false);
    expect(shouldIgnorePackagedPath('/node_modules/file-uri-to-path')).toBe(false);
    expect(shouldIgnorePackagedPath('/node_modules/node-addon-api')).toBe(false);
    expect(shouldIgnorePackagedPath('/src/main.ts')).toBe(true);
    expect(shouldIgnorePackagedPath('/node_modules/react')).toBe(true);
  });
});
