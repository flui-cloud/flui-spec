import type { FluiApiVersion } from './api-version';
import type { FluiHealthcheck, FluiHttpsRequirement, FluiSmokeTest } from './shared';

export type EnvDelivery = 'runtime' | 'browser' | 'build';

export interface ApplicationEnvValueFrom {
  generate?: 'secret';
  length?: number;
  format?: 'base64url' | 'hex';
  secretRef?: string;
  /** Reference to another Flui app in the same project; resolved per-environment. */
  service?: string;
  /** Which attribute of the referenced service to inject. Defaults to `url`. */
  key?: 'url' | 'host' | 'port';
  userInput?: {
    label?: string;
    default?: string;
    sensitive?: boolean;
    placeholder?: string;
    format?: 'email' | 'url' | 'password' | 'text';
  };
}

/** An entry in the preferred map form of `deploy.env`. A bare string is shorthand for `{ value }`. */
export interface ApplicationEnvEntry {
  value?: string;
  valueFrom?: ApplicationEnvValueFrom;
  delivery?: EnvDelivery;
  secret?: boolean;
  description?: string;
}

/** An entry in the deprecated array form of `deploy.env`. */
export interface ApplicationManifestEnvVar {
  name: string;
  value?: string;
  secret?: boolean;
  valueFrom?: ApplicationEnvValueFrom;
  userEditable?: boolean;
  description?: string;
}

/** `deploy.env` accepts the map form (preferred) or the legacy array form. */
export type ApplicationEnvMap = Record<string, string | ApplicationEnvEntry>;
export type ApplicationEnv = ApplicationManifestEnvVar[] | ApplicationEnvMap;

export interface ApplicationManifestResources {
  profile?: 'nano' | 'small' | 'medium' | 'large' | 'xlarge';
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

/** Shared with `kind: CatalogApp` — see `FluiHealthcheck`. */
export type ApplicationManifestHealthcheck = FluiHealthcheck;

export interface ApplicationManifestScaling {
  min?: number;
  max?: number;
}

export interface ApplicationManifestDomain {
  auto?: boolean;
  tls?: boolean;
  /**
   * Explicit FQDN to expose the app on (apex, or a subdomain on another zone).
   * Bypasses the cluster's assigned zone — taken verbatim.
   */
  fqdn?: string;
  hostnameMode?: 'ip' | 'domain';
  certChallenge?: 'http-01' | 'dns-01';
  certificateProvider?: 'lets-encrypt' | 'lets-encrypt-staging';
  userCustomizable?: boolean;
  httpsRequirement?: FluiHttpsRequirement;
}

export interface ApplicationManifestVolume {
  name: string;
  mountPath: string;
  size?: string;
}

export interface ApplicationManifestFile {
  /** Absolute path inside the container. */
  path: string;
  /** Literal content; `{{env.NAME}}` interpolates a key declared in deploy.env. */
  content: string;
  /** Octal mode on the host, e.g. "0600". */
  mode?: string;
}

/** One environment variable of the application, computed from an attached service. */
export interface ApplicationLinkedEnv {
  name: string;
  fromService?: 'host' | 'port' | 'url';
  fromBBEnv?: string;
  value?: string;
}

/** A catalog building block rendered inside this application's own pod. */
export interface ApplicationAttachedService {
  name: string;
  block: string;
  env: ApplicationLinkedEnv[];
  /** CPU/memory ceiling for the attached service itself, not for the application. */
  resources?: ApplicationManifestResources;
}

/**
 * The escape from one image per hostname: a value the build froze into its own output is
 * replaced at container start, before the application runs.
 */
export interface ApplicationManifestReplaceAtStart {
  /** Absolute paths inside the container: a file, or a directory walked recursively. */
  paths: string[];
  /** Sentinel → value. The value takes `{{env.NAME}}`, `{{app.domain}}` and `{{app.scheme}}`. */
  substitute: Record<string, string>;
}

export interface ApplicationManifestBuild {
  strategy?: 'dockerfile' | 'auto';
  dockerfile?: string;
  context?: string;
  /** Docker build ARGs (--build-arg). Env-independent, baked into the image. */
  args?: Record<string, string>;
  /** Shell commands run in the checkout before the image build, each as its own CI step. */
  prepare?: string[];
}

/**
 * A per-environment partial override merged over the base spec. `build` is
 * deliberately absent (the same image is promoted across environments); env
 * overrides are literal values only.
 */
export interface ApplicationEnvironmentProfile {
  branch?: string;
  deploy?: {
    resources?: ApplicationManifestResources;
    scaling?: ApplicationManifestScaling;
    domain?: ApplicationManifestDomain;
  };
  env?: Record<string, string>;
}

/**
 * How the workload is reached. `none` is the workload that does not listen — a worker, a queue
 * consumer — and is always declared, never inferred from a missing port.
 */
export type ApplicationExposure = 'public' | 'internal' | 'none';

/** Everything in `deploy` that reads the same whether or not the workload listens. */
export interface ApplicationDeployCommon {
  /** The post-deploy gate. Shared with `kind: CatalogApp`. */
  smokeTest?: FluiSmokeTest;
  resources?: ApplicationManifestResources;
  scaling?: ApplicationManifestScaling;
  env?: ApplicationEnv;
  volumes?: ApplicationManifestVolume[];
  /** Config files written beside the app and mounted read-only into the container. */
  files?: ApplicationManifestFile[];
  /** Building blocks attached to this application, inside its pod. */
  services?: ApplicationAttachedService[];
  /** Where the browser-facing runtime config file is written, and the global it assigns to. */
  browserConfig?: { path: string; global?: string };
  startCommand?: string;
  /** Sentinel strings rewritten inside the image's own files, in the container, before the app starts. */
  replaceAtStart?: ApplicationManifestReplaceAtStart;
}

/** A workload that listens: `port` is required, and a way in may be named. */
export interface ApplicationDeployListening extends ApplicationDeployCommon {
  exposure?: 'public' | 'internal';
  port: number;
  domain?: ApplicationManifestDomain;
  healthcheck?: ApplicationManifestHealthcheck;
}

/**
 * A workload that listens on nothing. The three fields that presuppose a listener are typed away
 * rather than left optional: `port?: number` would compile for a manifest the schema refuses, and
 * a type that accepts what the validator rejects is worse than no type at all.
 */
export interface ApplicationDeploySilent extends ApplicationDeployCommon {
  exposure: 'none';
  port?: never;
  domain?: never;
  /** An exec probe still works; an HTTP path does not, having no port to reach. */
  healthcheck?: Omit<ApplicationManifestHealthcheck, 'path'> & { path?: never };
}

export type ApplicationDeploy =
  | ApplicationDeployListening
  | ApplicationDeploySilent;

export interface ApplicationManifest {
  kind: 'Application';
  apiVersion: FluiApiVersion;
  metadata: {
    name: string;
  };
  build?: ApplicationManifestBuild;
  /**
   * Discriminated on `exposure`. Narrow before reading `port`, `domain` or `healthcheck.path`:
   * `if (manifest.deploy.exposure === 'none')` on one side, everything else on the other.
   */
  deploy: ApplicationDeploy;
  environments?: Record<string, ApplicationEnvironmentProfile>;
}
