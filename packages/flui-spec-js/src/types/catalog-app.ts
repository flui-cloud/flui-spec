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
  smokeTest?: CatalogSmokeTest;
  dependencies?: CatalogDependency[];
}

export interface CatalogSpecComposed {
  type: CatalogAppType.COMPOSED;
  scalingPolicy?: CatalogScalingPolicy;
  networking?: CatalogComposedNetworking;
  domain?: CatalogDomainSpec;
  auth?: CatalogAuth;
  components: CatalogComponent[];
}

export type CatalogAuthMode = 'oidc' | 'proxy' | 'native' | 'none';

export interface CatalogAuth {
  mode: CatalogAuthMode;
  oidc?: CatalogAuthOidc;
  proxy?: CatalogAuthProxy;
}

export interface CatalogAuthOidc {
  redirectPath?: string;
  scopes?: string[];
  envMapping?: {
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    enabledFlag?: string;
  };
}

export interface CatalogAuthProxy {
  headerMapping?: Record<string, string>;
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
