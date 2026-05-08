#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseYaml, FluiYamlParseError } from './parse';
import { validate } from './validate';

function printUsage(): void {
  process.stderr.write(
    [
      'Usage: flui-spec validate <path-to-flui.yaml>',
      '',
      'Validates a flui.yaml manifest against the spec.',
      'Exits 0 if valid, 1 if invalid, 2 on usage errors.',
      '',
    ].join('\n'),
  );
}

function main(argv: string[]): number {
  const [cmd, file] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    printUsage();
    return cmd ? 0 : 2;
  }
  if (cmd !== 'validate') {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    printUsage();
    return 2;
  }
  if (!file) {
    process.stderr.write('Missing file argument.\n');
    printUsage();
    return 2;
  }

  const path = resolve(process.cwd(), file);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    process.stderr.write(
      `Cannot read file ${path}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    if (err instanceof FluiYamlParseError) {
      process.stderr.write(`${err.message}\n`);
      return 1;
    }
    throw err;
  }

  const result = validate(parsed);
  if (result.valid) {
    process.stdout.write(
      `OK — kind=${result.manifest.kind} apiVersion=${result.manifest.apiVersion}\n`,
    );
    return 0;
  }

  process.stderr.write('Manifest is invalid:\n');
  for (const e of result.errors) {
    process.stderr.write(
      `  ${e.path} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}\n`,
    );
  }
  return 1;
}

process.exit(main(process.argv.slice(2)));
