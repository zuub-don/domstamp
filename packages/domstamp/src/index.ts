export {
  SNAPSHOT_FORMAT,
  SNAPSHOT_SCHEMA_VERSION,
  LEGACY_SNAPSHOT_SCHEMA_VERSION,
  PREVIOUS_SNAPSHOT_SCHEMA_VERSION,
  SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS
} from './schema.js';
export type {
  AccessibilityNode,
  AccessibilityStateValue,
  AccessibilityTree,
  CaptureConsistencyStatus,
  CaptureMode,
  DocumentSnapshot,
  DomSnapshot,
  DomSnapshotV2,
  EvidenceCompleteness,
  EvidenceDetailValue,
  EvidencePrivilege,
  EvidenceSensitivity,
  NodeReference,
  SnapshotAttachment,
  SnapshotEvidence,
  SnapshotNode,
  DomSnapshotV1,
  SupportedDomSnapshot
} from './schema.js';
export { inspectSnapshotCompatibility, migrateSnapshot } from './migrations.js';
export type { SnapshotCompatibility } from './migrations.js';
export { redactSnapshot } from './redaction.js';
export type { RedactionResult } from './redaction.js';
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
export { runAdapterConformance } from './conformance.js';
export type { AdapterConformanceOptions, AdapterConformanceReport } from './conformance.js';
export { DomstampError, isDomstampError } from './errors.js';
export type { DomstampErrorCode } from './errors.js';
export type {
  AdapterCapability,
  AdapterContext,
  CaptureDiagnostic,
  CaptureResult,
  DomstampAdapter,
  DomstampEvidenceProvider,
  DomstampPlugin,
  EvidenceObservation,
  EvidenceProviderContext,
  PluginContext
} from './adapter.js';
