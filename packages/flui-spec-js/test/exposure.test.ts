import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/parse';
import { validate } from '../src/validate';
import { applicationSchema } from '../src/schemas';
import { APPLICATION_EXPOSURE_DEFAULT } from '../src/defaults';

const HEAD = [
  'apiVersion: flui.cloud/v1beta1',
  'kind: Application',
  'metadata:',
  '  name: my-app',
  'deploy:',
];

const manifest = (...deployLines: string[]) =>
  parseYaml([...HEAD, ...deployLines.map((l) => `  ${l}`)].join('\n'));

const errorAt = (r: ReturnType<typeof validate>, path: string) =>
  r.valid ? undefined : r.errors.find((e) => e.path === path);

describe('deploy.exposure: none', () => {
  it('accepts a workload that declares it does not listen', () => {
    const r = validate(manifest('exposure: none', 'startCommand: node worker.js'));
    expect(r.valid).toBe(true);
  });

  it('refuses deploy.port, and says why at the port', () => {
    const r = validate(manifest('exposure: none', 'port: 3000'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/port')?.message).toMatch(
      /must not be set when exposure is none/,
    );
  });

  it('refuses deploy.domain, and says why at the domain', () => {
    const r = validate(
      manifest('exposure: none', 'domain:', '  fqdn: worker.example.com'),
    );
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/domain')?.message).toMatch(
      /must not be set when exposure is none/,
    );
  });

  it('refuses an HTTP probe path, and points at the path rather than the probe', () => {
    const r = validate(manifest('exposure: none', 'healthcheck:', '  path: /health'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/healthcheck/path')?.message).toMatch(
      /an HTTP probe needs a port to reach/,
    );
  });

  it('still accepts an exec probe, which needs no port', () => {
    const r = validate(
      manifest(
        'exposure: none',
        'healthcheck:',
        '  type: exec',
        '  command: ["pgrep", "-f", "worker"]',
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('never reports the bare `if` line alongside the branch it explains', () => {
    const r = validate(manifest('exposure: none', 'port: 3000'));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors.some((e) => /must match "then" schema/.test(e.message))).toBe(
        false,
      );
    }
  });
});

describe('deploy.port when the workload does listen', () => {
  it('is still required when exposure is omitted', () => {
    const r = validate(manifest('startCommand: node server.js'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/port')?.message).toMatch(/required property 'port'/);
  });

  it('is still required when exposure is public', () => {
    const r = validate(manifest('exposure: public'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/port')?.message).toMatch(/required property 'port'/);
  });

  it('is still required when exposure is internal', () => {
    const r = validate(manifest('exposure: internal'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/port')?.message).toMatch(/required property 'port'/);
  });

  it('names exposure: none as the alternative, so a real worker is not left guessing', () => {
    const r = validate(manifest('startCommand: node worker.js'));
    expect(errorAt(r, '/deploy/port')?.message).toMatch(/exposure: none/);
  });

  it('accepts port with domain and an HTTP probe, unchanged', () => {
    const r = validate(
      manifest(
        'port: 3000',
        'exposure: public',
        'domain:',
        '  fqdn: app.example.com',
        'healthcheck:',
        '  path: /health',
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('rejects an unknown exposure value', () => {
    const r = validate(manifest('port: 3000', 'exposure: worker'));
    expect(r.valid).toBe(false);
    expect(errorAt(r, '/deploy/exposure')).toBeDefined();
  });
});

describe('the default lives in the schema and nowhere else', () => {
  const exposure = (
    applicationSchema as {
      properties: {
        deploy: {
          properties: { exposure: { default: string; enum: string[] } };
        };
      };
    }
  ).properties.deploy.properties.exposure;

  it('exports the schema default rather than a second copy of it', () => {
    expect(APPLICATION_EXPOSURE_DEFAULT).toBe(exposure.default);
  });

  it('exports a value the enum actually allows', () => {
    expect(exposure.enum).toContain(APPLICATION_EXPOSURE_DEFAULT);
  });

  it('keeps the default at public — changing it would strand every manifest already written', () => {
    expect(APPLICATION_EXPOSURE_DEFAULT).toBe('public');
  });

  it('does not materialise the default into the parsed manifest', () => {
    // `default` is an annotation: the validator does not write it in. A consumer that needs the
    // resolved value reads APPLICATION_EXPOSURE_DEFAULT; nothing here silently edits the author's
    // document.
    const r = validate(manifest('port: 3000'));
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(
        (r.manifest as { deploy: { exposure?: string } }).deploy.exposure,
      ).toBeUndefined();
    }
  });
});
