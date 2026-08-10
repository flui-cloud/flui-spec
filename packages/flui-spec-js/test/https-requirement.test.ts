import { describe, it, expect } from 'vitest';
import { applicationSchema, catalogAppSchema } from '../src/schemas';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

/**
 * `domain.tls` is the operator asking for a certificate. `domain.httpsRequirement` is the
 * application stating whether it can live without one — an app with an unconditional HTTP→HTTPS
 * redirect, `Secure` cookies or an https OAuth callback simply does not work on plain HTTP, and
 * before this field nothing in either schema could say so.
 *
 * Both `domain` blocks are `additionalProperties: false`, so a field added to one kind and not the
 * other makes the same manifest valid as one and invalid as the other. The `domain` blocks are not
 * deep-equal (the Application one carries `fqdn` and richer prose) and `shared-definitions.test.ts`
 * only pairs `healthcheck` and `smokeTest` — so this property gets its own parity check.
 */

const app = applicationSchema as any;
const catalog = catalogAppSchema as any;

const VALUES = ['required', 'recommended', 'none'] as const;

const application = (domain: string[]) =>
  [
    'apiVersion: flui.cloud/v1beta1',
    'kind: Application',
    'metadata:',
    '  name: my-app',
    'deploy:',
    '  port: 3000',
    '  domain:',
    ...domain,
  ].join('\n');

const catalogApp = (domain: string[]) =>
  [
    'apiVersion: flui.cloud/v1beta1',
    'kind: CatalogApp',
    'metadata:',
    '  id: my-app',
    '  name: My App',
    '  appKind: APPLICATION',
    '  category: test',
    '  version: 1.0.0',
    'spec:',
    '  type: standalone',
    '  image: { repository: ghcr.io/me/my-app, tag: "1" }',
    '  ports:',
    '    - { name: http, internal: 3000, expose: true, protocol: http }',
    '  env: []',
    '  resources: {}',
    '  scaling: { horizontal: { enabled: false }, vertical: { enabled: false } }',
    '  domain:',
    ...domain,
  ].join('\n');

describe('deploy.domain.httpsRequirement', () => {
  it('is present and identical in both schemas', () => {
    expect(app.definitions.domain.properties.httpsRequirement).toBeDefined();
    expect(catalog.definitions.domain.properties.httpsRequirement).toBeDefined();
    expect(app.definitions.domain.properties.httpsRequirement).toEqual(
      catalog.definitions.domain.properties.httpsRequirement,
    );
  });

  it.each(VALUES)('%s validates under kind: Application', (value) => {
    const r = validate(parseYaml(application([`    tls: true`, `    httpsRequirement: ${value}`])));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it.each(VALUES)('%s validates under kind: CatalogApp', (value) => {
    const r = validate(parseYaml(catalogApp([`    tls: true`, `    httpsRequirement: ${value}`])));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('rejects a value outside the enum under both kinds', () => {
    expect(validate(parseYaml(application(['    httpsRequirement: mandatory']))).valid).toBe(false);
    expect(validate(parseYaml(catalogApp(['    httpsRequirement: mandatory']))).valid).toBe(false);
  });

  it('stays optional: a domain block that omits it is valid under both kinds', () => {
    expect(validate(parseYaml(application(['    tls: true']))).valid).toBe(true);
    expect(validate(parseYaml(catalogApp(['    tls: true']))).valid).toBe(true);
  });
});
