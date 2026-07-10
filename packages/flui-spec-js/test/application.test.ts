import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';
import { applicationSchema } from '../src/schemas';

const VALID = [
  'apiVersion: flui.cloud/v1beta1',
  'kind: Application',
  'metadata:',
  '  name: my-app',
  'deploy:',
  '  port: 3000',
].join('\n');

describe('validate(Application)', () => {
  it('accepts a minimal valid Application manifest', () => {
    const r = validate(parseYaml(VALID));
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.manifest.kind).toBe('Application');
  });

  it('accepts the legacy apiVersion flui/v1', () => {
    const yaml = VALID.replace('flui.cloud/v1beta1', 'flui/v1');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(true);
  });

  it('rejects an unknown apiVersion', () => {
    const yaml = VALID.replace('flui.cloud/v1beta1', 'flui/v99');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path === '/apiVersion')).toBe(true);
    }
  });

  it('rejects when metadata.name is missing', () => {
    const yaml = VALID.replace('  name: my-app\n', '');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path.startsWith('/metadata'))).toBe(true);
    }
  });

  it('points required errors at the missing field (metadata: {})', () => {
    const yaml = VALID.replace('  name: my-app', '  other: x');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path === '/metadata/name')).toBe(true);
    }
  });

  it('rejects metadata.name not matching slug pattern', () => {
    const yaml = VALID.replace('my-app', 'My App!');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(
        r.errors.some(
          (e) =>
            e.path === '/metadata/name' && /must match/.test(e.message),
        ),
      ).toBe(true);
    }
  });

  it('rejects when deploy is missing', () => {
    const yaml = VALID.replace(/deploy:\n {2}port: 3000\n?/, '');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path === '/deploy')).toBe(true);
    }
  });

  it('rejects when deploy.port is missing', () => {
    const yaml = VALID.replace('  port: 3000', '  exposure: public');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path === '/deploy/port')).toBe(true);
    }
  });

  it('rejects an unknown top-level key (additionalProperties)', () => {
    const r = validate(parseYaml(`${VALID}\ndeployy:\n  port: 3000`));
    expect(r.valid).toBe(false);
  });

  it('rejects a healthcheck without a path', () => {
    const yaml = `${VALID}\n  healthcheck:\n    port: 3000`;
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(
        r.errors.some((e) => e.path.startsWith('/deploy/healthcheck')),
      ).toBe(true);
    }
  });
});

const BROAD = [
  'apiVersion: flui.cloud/v1beta1',
  'kind: Application',
  'metadata:',
  '  name: my-app',
  'deploy:',
  '  port: 3000',
  '  resources:',
  '    profile: small',
  '  scaling:',
  '    min: 1',
  '    max: 3',
  '  env:',
  '    - name: NODE_ENV',
  '      value: production',
  '    - name: SESSION_SECRET',
  '      valueFrom:',
  '        generate: secret',
  '        length: 48',
].join('\n');

describe('validate(Application) — broad spec + planned warnings', () => {
  it('accepts planned fields (profile, scaling, valueFrom) as valid', () => {
    const r = validate(parseYaml(BROAD));
    expect(r.valid).toBe(true);
  });

  it('warns about each planned field in use, without invalidating', () => {
    const r = validate(parseYaml(BROAD));
    expect(r.valid).toBe(true);
    const paths = r.warnings.map((w) => w.path);
    expect(paths).toContain('/deploy/resources/profile');
    expect(paths).toContain('/deploy/scaling');
    expect(paths).toContain('/deploy/env/1/valueFrom');
  });

  it('warns about an env var with neither value nor valueFrom', () => {
    const yaml = `${VALID}\n  env:\n    - name: PLACEHOLDER`;
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.path === '/deploy/env/0')).toBe(true);
  });

  it('emits no warnings for a fully-implemented manifest', () => {
    const r = validate(parseYaml(VALID));
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.warnings).toEqual([]);
  });

  // Governance: the warning generator and the schema's x-flui-status tags must
  // stay in lockstep. If a field is promoted to implemented, flipping the tag
  // here fails until the warning is removed too (and vice versa).
  it('tags every warned field as x-flui-status: planned in the schema', () => {
    const s = applicationSchema as any;
    const deploy = s.properties.deploy.properties;
    expect(deploy.resources.properties.profile['x-flui-status']).toBe('planned');
    expect(deploy.scaling['x-flui-status']).toBe('planned');
    const envVar = s.definitions.envVar.properties;
    expect(envVar.valueFrom['x-flui-status']).toBe('planned');
    expect(envVar.secret['x-flui-status']).toBe('planned');
    expect(envVar.userEditable['x-flui-status']).toBe('planned');
  });
});

describe('validate — top-level guards', () => {
  it('rejects null', () => {
    const r = validate(null);
    expect(r.valid).toBe(false);
  });

  it('rejects a non-object root', () => {
    const r = validate('a string');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors[0].path).toBe('<root>');
  });

  it('rejects a missing kind', () => {
    const r = validate({});
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors[0].path).toBe('/kind');
  });
});

describe('validate(CatalogApp) — extra branches', () => {
  it('reports component depending on unknown component', () => {
    const yaml = [
      'apiVersion: flui.cloud/v1beta1',
      'kind: CatalogApp',
      'metadata:',
      '  id: bad-dep',
      '  name: Bad Dep',
      '  appKind: APPLICATION',
      '  category: test',
      '  version: 1.0.0',
      'spec:',
      '  type: composed',
      '  components:',
      '    - name: a',
      '      image: { repository: x, tag: latest }',
      '      env: []',
      '      resources: {}',
      '      scaling: { horizontal: { enabled: false }, vertical: { enabled: false } }',
      '      dependsOn: [does-not-exist]',
    ].join('\n');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(
        r.errors.some((e) => /unknown component/.test(e.message)),
      ).toBe(true);
    }
  });

  it('reports duplicate refs in linkedBuildingBlocks', () => {
    const pgweb = readFileSync(
      resolve(__dirname, 'fixtures', 'pgweb-with-linked-bb.flui.yaml'),
      'utf-8',
    );
    const parsed = parseYaml(pgweb) as {
      spec: {
        linkedBuildingBlocks: Array<{
          ref: string;
          envMapping: Array<{ name: string; fromService?: string }>;
        }>;
      };
    };
    parsed.spec.linkedBuildingBlocks.push({
      ref: 'postgresql',
      envMapping: [{ name: 'PGHOST_DUP', fromService: 'host' }],
    });
    const r = validate(parsed);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => /duplicate ref/.test(e.message))).toBe(
        true,
      );
    }
  });

  it('rejects malformed CatalogApp (AJV path) — missing required field', () => {
    const yaml = [
      'apiVersion: flui.cloud/v1beta1',
      'kind: CatalogApp',
      'metadata:',
      '  id: missing',
      '  name: Missing',
      '  appKind: APPLICATION',
      '  category: test',
      '  version: 1.0.0',
      'spec:',
      '  type: standalone',
    ].join('\n');
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.length).toBeGreaterThan(0);
  });
});
