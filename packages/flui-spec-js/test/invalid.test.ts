import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

describe('validate — rejects invalid manifests', () => {
  it('unknown kind', () => {
    const r = validate(
      parseYaml('apiVersion: flui.cloud/v1beta1\nkind: WhatIsThis\n'),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors.some((e) => e.path === '/kind')).toBe(true);
    }
  });

  it('Application without deploy.port', () => {
    const r = validate(
      parseYaml(
        [
          'apiVersion: flui.cloud/v1beta1',
          'kind: Application',
          'metadata:',
          '  name: my-app',
          'deploy: {}',
        ].join('\n'),
      ),
    );
    expect(r.valid).toBe(false);
  });

  it('CatalogApp composed with cycle is rejected', () => {
    const r = validate(
      parseYaml(
        [
          'apiVersion: flui.cloud/v1beta1',
          'kind: CatalogApp',
          'metadata:',
          '  id: cyclic',
          '  name: Cyclic',
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
          '      dependsOn: [b]',
          '    - name: b',
          '      image: { repository: x, tag: latest }',
          '      env: []',
          '      resources: {}',
          '      scaling: { horizontal: { enabled: false }, vertical: { enabled: false } }',
          '      dependsOn: [a]',
        ].join('\n'),
      ),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(
        r.errors.some((e) => /cycle detected/i.test(e.message)),
      ).toBe(true);
    }
  });

  it('clientDefaultFor without matching clientFor entry is rejected', () => {
    const r = validate(
      parseYaml(
        [
          'apiVersion: flui.cloud/v1beta1',
          'kind: CatalogApp',
          'metadata:',
          '  id: demo',
          '  name: Demo',
          '  appKind: APPLICATION',
          '  category: test',
          '  version: 1.0.0',
          '  clientFor: [postgresql]',
          '  clientDefaultFor: [mariadb]',
          'spec:',
          '  type: standalone',
          '  image: { repository: x, tag: latest }',
          '  ports: [{ name: http, internal: 80, expose: true }]',
          '  env: []',
          '  resources: {}',
          '  scaling: { horizontal: { enabled: false }, vertical: { enabled: false } }',
        ].join('\n'),
      ),
    );
    expect(r.valid).toBe(false);
  });
});
