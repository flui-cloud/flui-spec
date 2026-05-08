import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

const EXAMPLES_DIR = resolve(__dirname, '..', '..', '..', 'examples');

describe('shipped examples', () => {
  it.each([
    'application/nextjs.flui.yaml',
    'catalog/minimal-standalone.flui.yaml',
  ])('validates %s', (relPath) => {
    const raw = readFileSync(resolve(EXAMPLES_DIR, relPath), 'utf-8');
    const parsed = parseYaml(raw);
    const result = validate(parsed);
    if (!result.valid) {
      throw new Error(
        `validation failed for ${relPath}:\n${result.errors
          .map((e) => `  ${e.path} ${e.message}`)
          .join('\n')}`,
      );
    }
    expect(result.valid).toBe(true);
  });
});
