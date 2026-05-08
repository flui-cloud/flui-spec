import { load, CORE_SCHEMA } from 'js-yaml';
import { createHash } from 'node:crypto';

export class FluiYamlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FluiYamlParseError';
  }
}

export function parseYaml(rawYaml: string): unknown {
  try {
    return load(rawYaml, { schema: CORE_SCHEMA });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FluiYamlParseError(`Invalid YAML: ${message}`);
  }
}

export function computeChecksum(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((x) => stableStringify(x)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const parts = keys.map(
    (k) => JSON.stringify(k) + ':' + stableStringify(obj[k]),
  );
  return '{' + parts.join(',') + '}';
}
