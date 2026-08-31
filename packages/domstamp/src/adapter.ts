import type { CaptureConfig, CaptureSettings } from './config.js';
import type { DomSnapshot } from './schema.js';

export type AdapterCapability =
  | 'accessibility-tree'
  | 'closed-shadow-roots'
  | 'cross-origin-frames'
  | 'dom'
  | 'frames'
  | 'interaction'
  | 'layout'
  | 'mutation-consistency'
  | 'open-shadow-roots'
  | 'pixels'
  | 'redaction';

export interface AdapterContext<TAdapterOptions = unknown> {
  readonly config: CaptureConfig<TAdapterOptions>;
  readonly signal: AbortSignal;
}

export interface DomstampAdapter<TTarget, TAdapterOptions = unknown> {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ReadonlySet<AdapterCapability>;
  /** Capability-safe defaults applied before consumer defaults. */
  readonly defaults?: CaptureSettings<TAdapterOptions>;
  capture(target: TTarget, context: AdapterContext<TAdapterOptions>): Promise<DomSnapshot>;
}

export interface CaptureDiagnostic {
  readonly level: 'info' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CaptureResult {
  readonly snapshot: DomSnapshot;
  readonly adapter: Readonly<{ name: string; version: string }>;
  readonly durationMs: number;
  readonly diagnostics: readonly CaptureDiagnostic[];
}

export interface PluginContext<TTarget, TAdapterOptions = unknown> {
  readonly target: TTarget;
  readonly adapter: Readonly<{ name: string; version: string }>;
  readonly config: CaptureConfig<TAdapterOptions>;
  readonly signal: AbortSignal;
}

export interface DomstampPlugin<TTarget, TAdapterOptions = unknown> {
  readonly name: string;
  beforeCapture?(context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
  transform?(snapshot: DomSnapshot, context: PluginContext<TTarget, TAdapterOptions>): DomSnapshot | Promise<DomSnapshot>;
  afterCapture?(result: CaptureResult, context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
  onError?(error: unknown, context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
}
