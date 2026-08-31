export {
  SNAPSHOT_FORMAT,
  SNAPSHOT_SCHEMA_VERSION
} from './schema.js';
export type {
  CaptureConsistencyStatus,
  CaptureMode,
  DocumentSnapshot,
  DomSnapshot,
  NodeReference,
  SnapshotNode
} from './schema.js';
export { DEFAULT_CAPTURE_CONFIG, defineConfig } from './config.js';
export type {
  CaptureConfig,
  CaptureFeatures,
  CaptureLimits,
  CaptureOverrides,
  CaptureSettings,
  ConsistencyOptions,
  DataPolicy,
  DomFeatureOptions,
  FrameFeatureOptions,
  InteractionFeatureOptions,
  LayoutFeatureOptions,
  ShadowRootPolicy,
  SnapshotScope
} from './config.js';
export { createDomstamp, validateConfig, validateSnapshot } from './client.js';
export type { Domstamp, DomstampOptions, SnapshotValidationLimits } from './client.js';
export { DomstampError, isDomstampError } from './errors.js';
export type { DomstampErrorCode } from './errors.js';
export type {
  AdapterCapability,
  AdapterContext,
  CaptureDiagnostic,
  CaptureResult,
  DomstampAdapter,
  DomstampPlugin,
  PluginContext
} from './adapter.js';
