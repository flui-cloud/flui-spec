/**
 * Definitions both manifest kinds carry, field for field.
 *
 * `healthcheck` and `smokeTest` describe things the *pipeline* does — a probe inside the container
 * and a gate on the host — not things a packager does for software they did not write. So they
 * belong to whoever is deploying, whichever kind they wrote it in. The two JSON Schemas each keep
 * their own copy (they must stay standalone for ajv) and a parity test asserts the copies are
 * deep-equal; these types are the single copy on the TypeScript side.
 */

export interface FluiHealthcheck {
  /** Omitted means `http` — a healthcheck declaring only `path` is complete. */
  type?: 'http' | 'tcp' | 'exec';
  /** Required for an http probe: a real route that returns 2xx. */
  path?: string;
  port?: number;
  /** Required for an exec probe. */
  command?: string[];
  /**
   * Extra HTTP request headers for the probe (http type only). Use to send a
   * trusted `Host` (e.g. localhost) to apps that reject unknown Hosts on their
   * health path — the kubelet otherwise sends the pod IP, which such apps 400.
   */
  httpHeaders?: Record<string, string>;
  initialDelay?: string;
  interval?: string;
  timeout?: string;
  retries?: number;
}

export interface FluiSmokeTestHttp {
  type: 'http';
  path?: string;
  expectedStatus?: number;
  timeoutSeconds?: number;
  retries?: number;
}

export interface FluiSmokeTestTcp {
  type: 'tcp';
  port?: number;
  timeoutSeconds?: number;
  retries?: number;
}

export interface FluiSmokeTestScript {
  type: 'script';
  inline?: string;
  file?: string;
  shell?: string;
  timeoutSeconds?: number;
  retries?: number;
}

export interface FluiSmokeTestSkip {
  type: 'skip';
  reason?: string;
}

export type FluiSmokeTest =
  | FluiSmokeTestHttp
  | FluiSmokeTestTcp
  | FluiSmokeTestScript
  | FluiSmokeTestSkip;

/**
 * What the APPLICATION needs, which `domain.tls` cannot say: `tls` is the operator asking for a
 * certificate. `required` means the app does not work over plain HTTP at all — a client refuses a
 * deploy that would not be reachable over HTTPS; `recommended` warns and proceeds; `none`, like an
 * absent field, means nothing is said.
 */
export type FluiHttpsRequirement = 'required' | 'recommended' | 'none';
