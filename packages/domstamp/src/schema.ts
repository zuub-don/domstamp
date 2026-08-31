export const SNAPSHOT_FORMAT = 'domstamp' as const;
export const SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type CaptureMode = 'document' | 'viewport' | 'focus';

export interface NodeReference {
  readonly kind: string;
  readonly value: string;
  readonly target: number | null;
}

export interface SnapshotNode {
  readonly id: number;
  readonly parent: number | null;
  readonly depth: number;
  readonly path: string;
  readonly kind: string;
  readonly name: string;
  readonly namespace: string | null;
  readonly value: string | null;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
  readonly references: readonly NodeReference[];
  readonly state: Readonly<Record<string, boolean | number | string | null>>;
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }> | null;
  readonly style: Readonly<Record<string, string>>;
}

export type CaptureConsistencyStatus = 'stable' | 'unstable' | 'detached' | 'error';

export interface DocumentSnapshot {
  readonly frameId: string;
  readonly parentFrameId: string | null;
  readonly ownerPath: string | null;
  readonly url: string;
  readonly origin: string;
  readonly title: string;
  readonly frameName: string;
  readonly mode: CaptureMode;
  readonly activeNode: number | null;
  readonly selection: Readonly<{
    anchorNode: number | null;
    anchorOffset: number;
    focusNode: number | null;
    focusOffset: number;
    direction: string;
  }> | null;
  readonly scroll: Readonly<{ x: number; y: number }>;
  readonly consistency: Readonly<{
    status: CaptureConsistencyStatus;
    epochStart: number | null;
    epochEnd: number | null;
  }>;
  readonly truncated: Readonly<{ nodes: boolean; depth: boolean }>;
  readonly nodes: readonly SnapshotNode[];
}

export interface DomSnapshot {
  readonly format: typeof SNAPSHOT_FORMAT;
  readonly schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  readonly viewport: Readonly<{ width: number; height: number }> | null;
  readonly pointer: Readonly<{ x: number; y: number; type: string; buttons: number }> | null;
  readonly framesTruncated: boolean;
  readonly documents: readonly DocumentSnapshot[];
}
