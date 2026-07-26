import type { FluiApiVersion } from './api-version';
import {
  ApplicationKind,
  CatalogAppType,
  ScalingPolicyPreset,
  VpaMode,
} from './enums';

export interface CatalogAppManifest {
  kind: 'CatalogApp';
  apiVersion: FluiApiVersion;
  metadata: CatalogMetadata;
  spec: CatalogSpec;
}

export interface CatalogMetadata {
  id: string;
  name: string;
  description?: string;
  appKind: ApplicationKind;
  category: string;
  tags?: string[];
  license?: string;
  version: string;
  icon?: string;
  links?: CatalogLinks;
  ratings?: CatalogRatings;
  alternativeTo?: string[];
  maintainedAt?: string;
  entrypointPath?: string;
  clientFor?: string[];
  clientDefaultFor?: string[];
  draft?: boolean;
}

export interface CatalogLinks {
  website?: string;
  docs?: string;
  source?: string;
}

export interface CatalogRatings {
  wow?: number;
  utility?: number;
  euFit?: number;
  community?: number;
}

export type CatalogSpec =
  | CatalogSpecStandalone
  | CatalogSpecBuildingBlock
  | CatalogSpecComposed;

export type CatalogExposure = 'public' | 'internal';

export type CatalogPersistenceScope = 'shared' | 'dedicated';

export interface CatalogPersistence {
  scope: CatalogPersistenceScope;
}

export interface CatalogSpecStandalone {
  type: CatalogAppType.STANDALONE;
  image: CatalogImageSource;
  ports: CatalogPort[];
  volumes?: CatalogVolume[];
  persistence?: CatalogPersistence;
  env: CatalogEnvVar[];
  resources: CatalogResources;
  scaling: CatalogScaling;
  healthcheck?: CatalogHealthcheck;
  exposure?: CatalogExposure;
  privatizable?: boolean;
  domain?: CatalogDomainSpec;
  auth?: CatalogAuth;
  access?: CatalogAccess;
  postInstall?: CatalogPostInstallStep[];
  startCommand?: string;
  linkedBuildingBlocks?: CatalogLinkedBuildingBlock[];
  dependencies?: CatalogDependency[];
  smokeTest?: CatalogSmokeTest;
}

export interface CatalogLinkedBuildingBlock {
  ref: string;
  envMapping: CatalogLinkedEnv[];
}

export interface CatalogLinkedEnv {
  name: string;
  fromService?: 'host' | 'port';
  fromBBEnv?: string;
  value?: string;
}

export interface CatalogSpecBuildingBlock {
  type: CatalogAppType.BUILDING_BLOCK;
  image: CatalogImageSource;
  ports: CatalogPort[];
  volumes?: CatalogVolume[];
  persistence?: CatalogPersistence;
  env: CatalogEnvVar[];
  resources: CatalogResources;
  scaling: CatalogScaling;
  healthcheck: CatalogHealthcheck;
  startCommand?: string;
  auth?: CatalogAuth;
  access?: CatalogAccess;
  postInstall?: CatalogPostInstallStep[];
  smokeTest?: CatalogSmokeTest;
  dependencies?: CatalogDependency[];
}

export interface CatalogSpecComposed {
  type: CatalogAppType.COMPOSED;
  scalingPolicy?: CatalogScalingPolicy;
  networking?: CatalogComposedNetworking;
  domain?: CatalogDomainSpec;
  auth?: CatalogAuth;
  access?: CatalogAccess;
  /** Install-time feature toggles; gate components & postInstall via `when.option`. */
  options?: CatalogOption[];
  postInstall?: CatalogPostInstallStep[];
  components: CatalogComponent[];
}

export interface CatalogOption {
  key: string;
  label: string;
  description?: string;
  /** Pre-selected state when the installer offers the toggle. */
  default?: boolean;
}

export type CatalogAuthMode = 'oidc' | 'proxy' | 'native' | 'none';

export interface CatalogAuth {
  /** Single fixed mode (legacy/shorthand). Prefer `modes` + `default`. */
  mode?: CatalogAuthMode;
  /** Methods the app offers; the installer lets the user pick one. */
  modes?: CatalogAuthMode[];
  /** Pre-selected method at install time when `modes` is offered. */
  default?: CatalogAuthMode;
  oidc?: CatalogAuthOidc;
  proxy?: CatalogAuthProxy;
}

export interface CatalogAuthOidc {
  redirectPath?: string;
  /** Redirect/callback paths registered on the IdP client (host added at install). */
  redirectPaths?: string[];
  scopes?: string[];
  /** Env-based injection: maps OIDC values to the app's env var names. */
  envMapping?: {
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    enabledFlag?: string;
  };
  /** File-based injection: render `template` (with {{oidc.*}}) to `path`, point `env` at it. */
  configFile?: {
    path: string;
    env: string;
    template: string;
  };
}

export interface CatalogAuthProxy {
  headerMapping?: Record<string, string>;
}

/**
 * How a user logs into the app after install. Orthogonal to `auth` (which is
 * *how* authentication works): `access` is *what to hand the user* — the login
 * URL and the admin credentials, wherever they come from (a value the user set,
 * a secret generated on the host, or a default baked into the image).
 */
export type CatalogAccessMode = 'credentials' | 'firstVisit' | 'none';

export interface CatalogAccess {
  /** Defaults to 'credentials' when the block is present. `firstVisit`: no
   * account exists until the first visitor claims it (e.g. WordPress installer,
   * Immich native sign-up). `none`: nothing to hand the user. */
  mode?: CatalogAccessMode;
  /** Login path under the app URL. Falls back to `metadata.entrypointPath`, then `/`. */
  path?: string;
  username?: CatalogAccessValue;
  password?: CatalogAccessValue;
  /** Shown with the credentials, e.g. "Change this after first login." */
  note?: string;
}

/** One credential part: an env reference (userInput/generate/default) or a fixed value. */
export interface CatalogAccessValue {
  /** Env var name whose runtime value is the credential (read back on reveal). */
  fromEnv?: string;
  /** Composed apps: the component declaring that env (default: the primary/exposed one). */
  component?: string;
  /** Value baked into the image (a fixed default, e.g. `umami`/`umami`). */
  value?: string;
}

export interface CatalogPostInstallStep {
  name: string;
  description?: string;
  /** Gate: step runs only if the install context matches (AND of keys). */
  when?: {
    authMode?: CatalogAuthMode | CatalogAuthMode[];
    /** Runs only if this install-time option (spec.options[].key) is enabled. */
    option?: string;
  };
  http?: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Relative to the app's primary endpoint URL. */
    path: string;
    headers?: Record<string, string>;
    body?: string;
    /** Status codes treated as success (e.g. [200,201,400] to tolerate "exists"). */
    expectStatus?: number[];
  };
  /**
   * Runs a command inside the primary component's pod. For apps configured via
   * a CLI rather than HTTP/config-file (e.g. Nextcloud `occ`). Args are templated
   * ({{install.resolvedFqdn}}, {{oidc.*}}, {{generate.password}}).
   */
  exec?: {
    command: string[];
    container?: string;
  };
}

export interface CatalogComponent {
  name: string;
  image: CatalogImageSource;
  ports?: CatalogPort[];
  volumes?: CatalogVolume[];
  persistence?: CatalogPersistence;
  env: CatalogEnvVar[];
  resources: CatalogResources;
  scaling: CatalogScaling;
  healthcheck?: CatalogHealthcheck;
  dependsOn?: string[];
  /** Component is created only if the gate matches (e.g. an optional feature). */
  when?: {
    /** Created only if this install-time option (spec.options[].key) is enabled. */
    option?: string;
  };
}

export interface CatalogComposedNetworking {
  internal: string;
}

export interface CatalogScalingPolicy {
  mode: ScalingPolicyPreset;
  notifications?: CatalogScalingNotifications;
}

export interface CatalogScalingNotifications {
  onScaleUp?: boolean;
  onOOMKill?: boolean;
  onScaleDown?: boolean;
  onVerticalResize?: boolean;
}

export interface CatalogImageSource {
  registry?: string;
  repository?: string;
  tag?: string;
  credentials?: CatalogImageCredentials;
  source?: CatalogImageBuildSource;
}

export interface CatalogImageCredentials {
  type: 'registry' | 'git-token';
  secretRef: string;
}

export interface CatalogImageBuildSource {
  type: 'git';
  url: string;
  branch: string;
  dockerfile?: string;
}

export interface CatalogPort {
  name: string;
  internal: number;
  expose: boolean;
  protocol?: 'http' | 'tcp';
  /**
   * How this HTTP port is published through the app's ingress hostname. Absent =
   * the primary component's first HTTP port becomes the root (`/`); a secondary
   * component's port needs an explicit `route` to be fronted (e.g. an API at
   * `/api` alongside the web UI). Ignored for non-HTTP ports.
   */
  route?: CatalogPortRoute;
}

export interface CatalogPortRoute {
  /** Path prefix under the app hostname, e.g. `/api`. Omitted or `/` = root. */
  path?: string;
  /** Reserved: a dedicated subdomain instead of a path prefix (not yet supported). */
  subdomain?: string;
  /** Strip the path prefix before proxying to the backend (default false). */
  stripPrefix?: boolean;
}

export interface CatalogVolume {
  name: string;
  mountPath: string;
  required?: boolean;
  size?: string;
}

export interface CatalogEnvVar {
  name: string;
  value?: string;
  secret?: boolean;
  valueFrom?: CatalogValueFrom;
  userEditable?: boolean;
  description?: string;
}

export type CatalogValueFrom =
  | CatalogValueFromGenerate
  | CatalogValueFromSecretRef
  | CatalogValueFromUserInput;

export interface CatalogValueFromGenerate {
  generate: 'secret';
  length: number;
  format?: 'base64url' | 'hex';
}

export interface CatalogValueFromSecretRef {
  secretRef: string;
}

export interface CatalogValueFromUserInput {
  userInput: CatalogUserInputPrompt;
}

export interface CatalogUserInputPrompt {
  label?: string;
  default?: string;
  sensitive?: boolean;
  /**
   * Whether the installer must collect a value. Independent of `sensitive`
   * (which only controls Secret vs plaintext storage). Defaults to `sensitive`:
   * a sensitive input is required unless this is explicitly `false`. Set `false`
   * on a sensitive input to make it optional, or `true` on a non-sensitive one
   * to require it.
   */
  required?: boolean;
  /**
   * Inputs sharing a group id form an "at least one of" set: each member is
   * individually optional, but the installer must collect a value for at least
   * one member of the group. Mutually exclusive with `required`/`default`.
   */
  group?: string;
  placeholder?: string;
  pattern?: string;
  patternDescription?: string;
  minLength?: number;
  maxLength?: number;
  confirm?: boolean;
  format?: 'email' | 'url' | 'password' | 'text';
}

export interface CatalogResources {
  requests?: CatalogResourceSpec;
  limits?: CatalogResourceSpec;
}

export interface CatalogResourceSpec {
  cpu?: string;
  memory?: string;
}

export interface CatalogScaling {
  horizontal: CatalogHpa;
  vertical: CatalogVpa;
}

export interface CatalogHpa {
  enabled: boolean;
  min?: number;
  max?: number;
  metrics?: CatalogHpaMetric[];
  behavior?: CatalogHpaBehavior;
}

export interface CatalogHpaMetric {
  type: 'cpu' | 'memory' | 'custom';
  target: CatalogHpaMetricTarget;
}

export interface CatalogHpaMetricTarget {
  type: 'utilization' | 'averageValue';
  value: number;
}

export interface CatalogHpaBehavior {
  scaleUp?: CatalogHpaBehaviorPolicy;
  scaleDown?: CatalogHpaBehaviorPolicy;
}

export interface CatalogHpaBehaviorPolicy {
  stabilizationWindow: string;
  step: number;
}

export interface CatalogVpa {
  enabled: boolean;
  mode?: VpaMode;
  bounds?: CatalogVpaBounds;
  updatePolicy?: CatalogVpaUpdatePolicy;
}

export interface CatalogVpaBounds {
  cpu?: CatalogVpaBoundsRange;
  memory?: CatalogVpaBoundsRange;
}

export interface CatalogVpaBoundsRange {
  min: string;
  max: string;
}

export interface CatalogVpaUpdatePolicy {
  trigger?: Array<'OOMKilled' | 'CPUThrottling'>;
  cooldown?: string;
}

export interface CatalogHealthcheck {
  type: 'http' | 'tcp' | 'exec';
  path?: string;
  port?: number;
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

export interface CatalogDomainSpec {
  auto?: boolean;
  userCustomizable?: boolean;
  tls?: boolean;
  hostnameMode?: 'ip' | 'domain';
  certChallenge?: 'http-01' | 'dns-01';
  certificateProvider?: 'lets-encrypt' | 'lets-encrypt-staging';
}

export interface CatalogDependency {
  ref: string;
  as: string;
  required?: boolean;
  reuseExisting?: boolean;
}

export interface CatalogSmokeTestHttp {
  type: 'http';
  path?: string;
  expectedStatus?: number;
  timeoutSeconds?: number;
  retries?: number;
}

export interface CatalogSmokeTestTcp {
  type: 'tcp';
  port?: number;
  timeoutSeconds?: number;
}

export interface CatalogSmokeTestScript {
  type: 'script';
  inline?: string;
  file?: string;
  shell?: string;
  timeoutSeconds?: number;
}

export interface CatalogSmokeTestSkip {
  type: 'skip';
  reason?: string;
}

export type CatalogSmokeTest =
  | CatalogSmokeTestHttp
  | CatalogSmokeTestTcp
  | CatalogSmokeTestScript
  | CatalogSmokeTestSkip;
