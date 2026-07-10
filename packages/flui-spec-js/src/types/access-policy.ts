import type { FluiApiVersion } from './api-version';

export type AccessRole = 'viewer' | 'editor' | 'manager';

export type AccessPrincipalType = 'user' | 'group' | 'service_account';

export interface AccessPrincipal {
  type: AccessPrincipalType;
  ref: string;
}

export interface AccessSelector {
  slugs?: string[];
  type?: 'system' | 'user';
  /** App kind/category — open string, matched against the live (evolving) app taxonomy. */
  kind?: string;
  clusterId?: string;
  clusterName?: string;
  provider?: string;
  project?: string;
  tags?: string[];
}

export type AccessScope =
  | { type: 'global' }
  | { type: 'section'; section: string }
  | { type: 'cluster'; cluster: string }
  | { type: 'selector'; selector: AccessSelector };

export interface AccessBinding {
  principal: AccessPrincipal;
  role: AccessRole;
  scope: AccessScope;
}

export interface AccessPolicyManifest {
  kind: 'AccessPolicy';
  apiVersion: FluiApiVersion;
  metadata: {
    name: string;
    description?: string;
  };
  spec: {
    bindings: AccessBinding[];
  };
}
