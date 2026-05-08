export const FLUI_API_VERSION = 'flui.cloud/v1beta1' as const;

export const FLUI_API_VERSION_LEGACY = 'flui/v1' as const;

export type FluiApiVersion =
  | typeof FLUI_API_VERSION
  | typeof FLUI_API_VERSION_LEGACY;
