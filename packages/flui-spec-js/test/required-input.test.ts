import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

const base = (envBlock: string): string =>
  [
    'apiVersion: flui.cloud/v1beta1',
    'kind: CatalogApp',
    'metadata:',
    '  id: hello-world',
    '  name: Hello World',
    '  description: Minimal example demonstrating userInput.required.',
    '  appKind: APPLICATION',
    '  category: example',
    '  version: 1.0.0',
    '  license: Apache-2.0',
    'spec:',
    '  type: standalone',
    '  image:',
    '    registry: docker.io',
    '    repository: library/nginx',
    '    tag: 1.27-alpine',
    '  ports:',
    '    - name: http',
    '      internal: 80',
    '      expose: true',
    '      protocol: http',
    envBlock,
    '  resources:',
    '    requests: { cpu: 50m, memory: 64Mi }',
    '    limits: { cpu: 200m, memory: 128Mi }',
    '  scaling:',
    '    horizontal: { enabled: false }',
    '    vertical: { enabled: false }',
    '  healthcheck: { type: http, path: /, port: 80 }',
  ].join('\n');

describe('userInput.required', () => {
  it('accepts required:false on a sensitive input (optional secret)', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: TELEGRAM_BOT_TOKEN',
            '      valueFrom:',
            '        userInput:',
            '          label: Telegram token',
            '          sensitive: true',
            '          required: false',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('accepts required:true on a non-sensitive input (required plaintext)', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: SITE_NAME',
            '      valueFrom:',
            '        userInput:',
            '          label: Site name',
            '          required: true',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('rejects a non-boolean required', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: SITE_NAME',
            '      valueFrom:',
            '        userInput:',
            '          required: "yes"',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(false);
  });
});

describe('userInput.group (at-least-one)', () => {
  const groupEnv = (extra: string[] = []): string =>
    [
      '  env:',
      '    - name: OPENAI_API_KEY',
      '      valueFrom:',
      '        userInput:',
      '          label: OpenAI key',
      '          sensitive: true',
      '          group: llm',
      '    - name: ANTHROPIC_API_KEY',
      '      valueFrom:',
      '        userInput:',
      '          label: Anthropic key',
      '          sensitive: true',
      '          group: llm',
      ...extra,
    ].join('\n');

  it('accepts a group of sensitive members', () => {
    expect(validate(parseYaml(base(groupEnv()))).valid).toBe(true);
  });

  it('rejects `required` alongside `group`', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: OPENAI_API_KEY',
            '      valueFrom:',
            '        userInput:',
            '          group: llm',
            '          required: true',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(false);
  });

  it('rejects `default` alongside `group`', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: OPENAI_API_KEY',
            '      valueFrom:',
            '        userInput:',
            '          group: llm',
            '          default: sk-x',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(false);
  });

  it('rejects a malformed group id', () => {
    const r = validate(
      parseYaml(
        base(
          [
            '  env:',
            '    - name: OPENAI_API_KEY',
            '      valueFrom:',
            '        userInput:',
            '          group: "LLM Provider"',
          ].join('\n'),
        ),
      ),
    );
    expect(r.valid).toBe(false);
  });
});
