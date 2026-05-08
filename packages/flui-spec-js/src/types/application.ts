import type { FluiApiVersion } from './api-version';

export interface ApplicationManifestEnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    generate?: 'secret';
    length?: number;
    format?: 'base64url' | 'hex';
    secretRef?: string;
    userInput?: {
      label?: string;
      default?: string;
      sensitive?: boolean;
      placeholder?: string;
      format?: 'email' | 'url' | 'password' | 'text';
    };
  };
  userEditable?: boolean;
  description?: string;
}

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

export interface ApplicationManifest {
  kind: 'Application';
  apiVersion: FluiApiVersion;
  metadata: {
    name: string;
  };
  build?: {
    strategy?: 'dockerfile' | 'auto';
    dockerfile?: string;
    context?: string;
  };
  deploy: {
    port: number;
    exposure?: 'public' | 'internal';
    healthcheck?: ApplicationManifestHealthcheck;
    resources?: ApplicationManifestResources;
    scaling?: ApplicationManifestScaling;
    domain?: ApplicationManifestDomain;
    env?: ApplicationManifestEnvVar[];
    volumes?: ApplicationManifestVolume[];
    startCommand?: string;
  };
}
