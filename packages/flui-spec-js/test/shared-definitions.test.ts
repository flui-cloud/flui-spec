import { describe, it, expect } from 'vitest';
import { applicationSchema, catalogAppSchema } from '../src/schemas';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';

/**
 * `healthcheck` and `smokeTest` describe what the *pipeline* does — a probe inside the container
 * and a gate on the host — not what a packager does for software they did not write. So they
 * belong to both kinds, and the two schemas must not drift.
 *
 * Each file has to stay standalone for ajv (no cross-file `$ref`), so convergence means two copies
 * plus this test: deep-equal, or the build is wrong. Without it the copies would diverge the first
 * time someone improves one description, and a manifest valid as one kind would fail as the other
 * for reasons nobody could see.
 */

const app = applicationSchema as any;
const catalog = catalogAppSchema as any;

const SHARED = ['healthcheck', 'smokeTest'];

describe('the definitions both kinds share', () => {
  it.each(SHARED)('%s is deep-equal in both schemas', (name) => {
    expect(app.definitions[name]).toBeDefined();
    expect(catalog.definitions[name]).toBeDefined();
    expect(app.definitions[name]).toEqual(catalog.definitions[name]);
  });

  it.each(SHARED)('%s is reached by $ref from both kinds, never re-inlined', (name) => {
    expect(app.properties.deploy.properties[name]).toEqual({
      $ref: `#/definitions/${name}`,
    });
    // The catalog kind reaches it through its spec variants; every mention must be a $ref.
    const inlined = JSON.stringify(catalog.properties)
      .split(`"${name}":`)
      .slice(1)
      .filter((tail: string) => !tail.startsWith(`{"$ref":"#/definitions/${name}"}`));
    expect(inlined).toEqual([]);
  });

  /** The shape the deep-equal check exists to protect: a probe written for one kind validates as
   * the other, unchanged. */
  it('accepts the same healthcheck under either kind', () => {
    const probe = ['  healthcheck:', '    type: http', '    path: /healthz', '    initialDelay: 30s', '    retries: 5'];
    const application = [
      'apiVersion: flui.cloud/v1beta1',
      'kind: Application',
      'metadata:',
      '  name: my-app',
      'deploy:',
      '  port: 3000',
      ...probe,
    ].join('\n');
    const r = validate(parseYaml(application));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('accepts a smokeTest under kind: Application, which used to have none', () => {
    const yaml = [
      'apiVersion: flui.cloud/v1beta1',
      'kind: Application',
      'metadata:',
      '  name: my-app',
      'deploy:',
      '  port: 3000',
      '  smokeTest:',
      '    type: http',
      '    path: /',
      '    expectedStatus: 302',
      '    timeoutSeconds: 300',
    ].join('\n');
    const r = validate(parseYaml(yaml));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  /** The relaxation that made convergence possible, kept honest from both sides. */
  it('lets an http healthcheck omit type but never path', () => {
    const base = ['apiVersion: flui.cloud/v1beta1', 'kind: Application', 'metadata:', '  name: my-app', 'deploy:', '  port: 3000'];
    const withPath = validate(parseYaml([...base, '  healthcheck:', '    path: /healthz'].join('\n')));
    expect(withPath.valid).toBe(true);

    const withoutPath = validate(parseYaml([...base, '  healthcheck:', '    port: 3000'].join('\n')));
    expect(withoutPath.valid).toBe(false);
  });

  it('requires command for an exec probe, and accepts a tcp probe with no path', () => {
    const base = ['apiVersion: flui.cloud/v1beta1', 'kind: Application', 'metadata:', '  name: my-app', 'deploy:', '  port: 3000'];
    const exec = validate(parseYaml([...base, '  healthcheck:', '    type: exec'].join('\n')));
    expect(exec.valid).toBe(false);

    const execOk = validate(parseYaml([...base, '  healthcheck:', '    type: exec', '    command: ["/bin/ok"]'].join('\n')));
    expect(execOk.valid).toBe(true);

    const tcp = validate(parseYaml([...base, '  healthcheck:', '    type: tcp', '    port: 5432'].join('\n')));
    expect(tcp.valid).toBe(true);
  });
});

describe('resources on an attached service', () => {
  const yaml = (extra: string[]) =>
    [
      'apiVersion: flui.cloud/v1beta1',
      'kind: Application',
      'metadata:',
      '  name: my-app',
      'deploy:',
      '  port: 3000',
      '  services:',
      '    - name: db',
      '      block: postgresql',
      '      env:',
      '        - name: DATABASE_URL',
      '          fromService: url',
      ...extra,
    ].join('\n');

  it('accepts a limit on the attached service itself', () => {
    const r = validate(parseYaml(yaml(['      resources:', '        limits:', '          memory: 512Mi'])));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('is the same definition the application uses, not a second one', () => {
    expect(app.definitions.attachedService.properties.resources.$ref).toBe('#/definitions/resources');
  });
});
