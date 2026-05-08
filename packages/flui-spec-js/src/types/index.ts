export * from './api-version';
export * from './enums';
export * from './catalog-app';
export * from './application';

import type { CatalogAppManifest } from './catalog-app';
import type { ApplicationManifest } from './application';

export type FluiManifest = CatalogAppManifest | ApplicationManifest;
