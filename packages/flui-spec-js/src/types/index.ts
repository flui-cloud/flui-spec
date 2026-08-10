export * from './api-version';
export * from './shared';
export * from './enums';
export * from './catalog-app';
export * from './application';
export * from './access-policy';

import type { CatalogAppManifest } from './catalog-app';
import type { ApplicationManifest } from './application';
import type { AccessPolicyManifest } from './access-policy';

export type FluiManifest =
  | CatalogAppManifest
  | ApplicationManifest
  | AccessPolicyManifest;
