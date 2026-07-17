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
  'build:',
  '  args:',
  '    BUILD_MODE: production',
  'deploy:',
  '  port: 3000',
  '  resources:',
  '    profile: small',
  '  scaling:',
  '    min: 1',
  '    max: 3',
  '  env:',
  '    NODE_ENV: production',
  '    PUBLIC_ID:',
  '      value: abc',
  '      delivery: browser',
  '    SESSION_SECRET:',
  '      valueFrom:',
  '        generate: secret',
  '        length: 48',
  'environments:',
  '  production:',
  '    branch: main',
  '    env:',
  '      PUBLIC_ID: prd',
].join('\n');

// Legacy array form of deploy.env — still accepted, warns as deprecated.
const LEGACY_ENV = [
  'apiVersion: flui.cloud/v1beta1',
  'kind: Application',
  'metadata:',
  '  name: my-app',
  'deploy:',
  '  port: 3000',
  '  env:',
  '    - name: NODE_ENV',
  '      value: production',
  '    - name: SESSION_SECRET',
  '      valueFrom:',
  '        generate: secret',
  '        length: 48',
].join('\n');

describe('validate(Application) — broad spec + planned warnings', () => {
  it('accepts planned fields (profile, scaling, valueFrom, delivery) as valid', () => {
    const r = validate(parseYaml(BROAD));
    expect(r.valid).toBe(true);
  });

  it('warns about each planned field in use (map env), without invalidating', () => {
    const r = validate(parseYaml(BROAD));
    expect(r.valid).toBe(true);
    const paths = r.warnings.map((w) => w.path);
    expect(paths).toContain('/deploy/resources/profile');
    expect(paths).toContain('/deploy/scaling');
    expect(paths).toContain('/deploy/env/SESSION_SECRET/valueFrom');
    expect(paths).toContain('/deploy/env/PUBLIC_ID/delivery');
  });

  it('does not warn about an environments block (applied on git-driven deploys)', () => {
    const r = validate(parseYaml(BROAD));
    expect(r.warnings.some((w) => w.path === '/environments')).toBe(false);
  });

  it('accepts and applies the legacy array env form, warning it is deprecated', () => {
    const r = validate(parseYaml(LEGACY_ENV));
    expect(r.valid).toBe(true);
    const paths = r.warnings.map((w) => w.path);
    expect(paths).toContain('/deploy/env');
    expect(paths).toContain('/deploy/env/1/valueFrom');
  });

  it('warns about a map env entry with neither value nor valueFrom', () => {
    const yaml = `${VALID}\n  env:\n    PLACEHOLDER: {}`;
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.path === '/deploy/env/PLACEHOLDER')).toBe(
      true,
    );
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
    expect(s.definitions.resources.properties.profile['x-flui-status']).toBe(
      'planned',
    );
    expect(s.definitions.scaling['x-flui-status']).toBe('planned');
    const entry = s.definitions.envEntry.oneOf[1].properties;
    expect(entry.delivery['x-flui-status']).toBe('planned');
    expect(entry.secret['x-flui-status']).toBe('planned');
    const legacy = s.definitions.envVarLegacy.properties;
    expect(legacy.secret['x-flui-status']).toBe('planned');
    expect(legacy.userEditable['x-flui-status']).toBe('planned');
    // environments is implemented (applied per-branch), so it carries no tag.
    expect(s.properties.environments['x-flui-status']).toBeUndefined();
  });

  // valueFrom is partially applied: the warning fires per-branch, so the
  // planned tag lives on the generate/userInput branches, not on the property.
  it('tags only the still-planned valueFrom branches (generate, userInput)', () => {
    const branches = (applicationSchema as any).definitions.valueFrom.oneOf;
    const [generate, secretRef, service, userInput] = branches;
    expect(generate['x-flui-status']).toBe('planned');
    expect(userInput['x-flui-status']).toBe('planned');
    expect(secretRef['x-flui-status']).toBeUndefined();
    expect(service['x-flui-status']).toBeUndefined();
  });

  it('does not warn about an applied valueFrom (secretRef, service)', () => {
    const yaml = `${VALID}
  env:
    DB_PASSWORD:
      valueFrom:
        secretRef: pg/POSTGRES_PASSWORD
    API_URL:
      valueFrom:
        service: my-api
        key: url`;
    const r = validate(parseYaml(yaml));
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => /valueFrom/.test(w.path))).toBe(false);
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
