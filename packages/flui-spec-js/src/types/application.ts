import type { FluiApiVersion } from './api-version';

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

export interface ApplicationManifestHealthcheck {
  path: string;
  port?: number;
}

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
}

export interface ApplicationManifestVolume {
  name: string;
  mountPath: string;
  size?: string;
}

export interface ApplicationManifestBuild {
  strategy?: 'dockerfile' | 'auto';
  dockerfile?: string;
  context?: string;
  /** Docker build ARGs (--build-arg). Env-independent, baked into the image. */
  args?: Record<string, string>;
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

export interface ApplicationManifest {
  kind: 'Application';
  apiVersion: FluiApiVersion;
  metadata: {
    name: string;
  };
  build?: ApplicationManifestBuild;
  deploy: {
    port: number;
    exposure?: 'public' | 'internal';
    healthcheck?: ApplicationManifestHealthcheck;
    resources?: ApplicationManifestResources;
    scaling?: ApplicationManifestScaling;
    domain?: ApplicationManifestDomain;
    env?: ApplicationEnv;
    volumes?: ApplicationManifestVolume[];
    startCommand?: string;
  };
  environments?: Record<string, ApplicationEnvironmentProfile>;
}
