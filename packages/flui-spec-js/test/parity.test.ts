import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

const SEED_DIR = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'flui.api',
  'src',
  'modules',
  'catalog',
  'seed',
);

const skipParity = !existsSync(SEED_DIR);

describe.skipIf(skipParity)(
  'parity with flui.api seed catalog',
  () => {
    const files = skipParity
      ? []
      : readdirSync(SEED_DIR).filter((f) => f.endsWith('.flui.yaml'));

    it('finds at least one seed file', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      it(`validates ${file}`, () => {
        const raw = readFileSync(resolve(SEED_DIR, file), 'utf-8');
        const parsed = parseYaml(raw);
        const result = validate(parsed);
        if (!result.valid) {
          throw new Error(
            `validation failed for ${file}:\n${result.errors
              .map((e) => `  ${e.path} ${e.message}`)
              .join('\n')}`,
          );
        }
        expect(result.valid).toBe(true);
      });
    }
  },
);
