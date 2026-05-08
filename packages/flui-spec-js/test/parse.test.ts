import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  computeChecksum,
  stableStringify,
  FluiYamlParseError,
} from '../src/parse';

describe('parseYaml', () => {
  it('parses valid YAML into a JS object', () => {
    const out = parseYaml('a: 1\nb: [2, 3]\n');
    expect(out).toEqual({ a: 1, b: [2, 3] });
  });

  it('throws FluiYamlParseError on syntactically invalid YAML', () => {
    expect(() => parseYaml('a: : :\n  -bad\n')).toThrow(FluiYamlParseError);
  });

  it('FluiYamlParseError carries a "Invalid YAML" prefix', () => {
    try {
      parseYaml(': : :');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FluiYamlParseError);
      expect((err as Error).message).toMatch(/^Invalid YAML:/);
      expect((err as Error).name).toBe('FluiYamlParseError');
    }
  });
});

describe('stableStringify', () => {
  it('handles primitives', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('a')).toBe('"a"');
    expect(stableStringify(true)).toBe('true');
  });

  it('serializes arrays preserving order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('serializes objects with keys sorted alphabetically', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('produces identical output regardless of key insertion order', () => {
    const a = stableStringify({ x: 1, y: { b: 2, a: 1 }, z: [1, 2] });
    const b = stableStringify({ z: [1, 2], y: { a: 1, b: 2 }, x: 1 });
    expect(a).toBe(b);
  });
});

describe('computeChecksum', () => {
  it('returns a 64-char hex SHA256', () => {
    const c = computeChecksum({ hello: 'world' });
    expect(c).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is order-insensitive thanks to stableStringify', () => {
    const a = computeChecksum({ x: 1, y: 2 });
    const b = computeChecksum({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    expect(computeChecksum({ x: 1 })).not.toBe(computeChecksum({ x: 2 }));
  });
});
