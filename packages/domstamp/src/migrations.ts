import { DomstampError } from './errors.js';
import { validateSnapshot } from './client.js';
import {
  LEGACY_SNAPSHOT_SCHEMA_VERSION,
  PREVIOUS_SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_FORMAT,
  SNAPSHOT_SCHEMA_VERSION,
  SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS,
  type DomSnapshot,
  type DomSnapshotV1,
  type DomSnapshotV2,
  type SupportedDomSnapshot
} from './schema.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface SnapshotCompatibility {
  readonly format: string | null;
  readonly schemaVersion: number | null;
  readonly currentVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  readonly readable: boolean;
  readonly migrationRequired: boolean;
}

export function inspectSnapshotCompatibility(value: unknown): SnapshotCompatibility {
  const format = isRecord(value) && typeof value.format === 'string' ? value.format : null;
  const schemaVersion = isRecord(value) && Number.isSafeInteger(value.schemaVersion)
    ? value.schemaVersion as number
    : null;
  const readable = format === SNAPSHOT_FORMAT
    && schemaVersion !== null
    && (SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS as readonly number[]).includes(schemaVersion);
  return Object.freeze({
    format,
    schemaVersion,
    currentVersion: SNAPSHOT_SCHEMA_VERSION,
    readable,
    migrationRequired: readable && schemaVersion !== SNAPSHOT_SCHEMA_VERSION
  });
}

export function migrateSnapshot(value: SupportedDomSnapshot): DomSnapshot;
export function migrateSnapshot(value: unknown): DomSnapshot;
export function migrateSnapshot(value: unknown): DomSnapshot {
  const compatibility = inspectSnapshotCompatibility(value);
  if (!compatibility.readable || !isRecord(value)) {
    throw new DomstampError('UNSUPPORTED_SCHEMA', 'Snapshot schema cannot be migrated by this version of Domstamp', {
      details: { ...compatibility }
    });
  }
  if (compatibility.schemaVersion === SNAPSHOT_SCHEMA_VERSION) {
    validateSnapshot(value);
    return value;
  }
  if (compatibility.schemaVersion === LEGACY_SNAPSHOT_SCHEMA_VERSION) {
    const legacy = value as unknown as DomSnapshotV1;
    const migrated: DomSnapshot = {
      ...legacy,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      accessibility: [],
      attachments: [],
      evidence: []
    };
    validateSnapshot(migrated);
    return migrated;
  }
  if (compatibility.schemaVersion === PREVIOUS_SNAPSHOT_SCHEMA_VERSION) {
    const previous = value as unknown as DomSnapshotV2;
    const migrated: DomSnapshot = {
      ...previous,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      evidence: []
    };
    validateSnapshot(migrated);
    return migrated;
  }
  throw new DomstampError('UNSUPPORTED_SCHEMA', 'No migration path exists for this snapshot schema', {
    details: { ...compatibility }
  });
}
