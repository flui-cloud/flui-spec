export enum ApplicationKind {
  DATABASE = 'DATABASE',
  APPLICATION = 'APPLICATION',
  TOOL = 'TOOL',
  SYSTEM = 'SYSTEM',
}

export enum CatalogAppType {
  STANDALONE = 'standalone',
  BUILDING_BLOCK = 'building-block',
  COMPOSED = 'composed',
}

export enum ScalingPolicyPreset {
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive',
}

export enum VpaMode {
  OFF = 'Off',
  INITIAL = 'Initial',
  RECREATE = 'Recreate',
  AUTO = 'Auto',
}
