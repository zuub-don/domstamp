import type { CaptureMode } from './schema.js';

export type ShadowRootPolicy = 'none' | 'open' | 'all-available';

export type SnapshotScope =
  | Readonly<{ mode: 'document'; root?: string }>
  | Readonly<{ mode: 'viewport'; root?: string; margin?: number }>
  | Readonly<{
      mode: 'focus';
      root?: string;
      siblingCount?: number;
      includeReferences?: boolean;
    }>;

export interface DomFeatureOptions {
  readonly comments: boolean;
  readonly shadowRoots: ShadowRootPolicy;
  readonly templates: boolean;
}

export interface LayoutFeatureOptions {
  readonly geometry: boolean;
  readonly computedStyles: 'minimal' | 'all' | readonly string[];
}

export interface FrameFeatureOptions {
  readonly crossOrigin: boolean;
  readonly maxFrames: number;
}

export interface InteractionFeatureOptions {
  readonly focus: boolean;
  readonly selection: boolean;
  readonly pointer: boolean;
  readonly formState: boolean;
  readonly scroll: boolean;
}

export interface CaptureFeatures {
  readonly dom: DomFeatureOptions;
  readonly layout: false | LayoutFeatureOptions;
  readonly frames: false | FrameFeatureOptions;
  readonly interaction: false | InteractionFeatureOptions;
  readonly accessibility: false | Readonly<{ relationships: boolean; tree: boolean }>;
  readonly pixels: false | Readonly<{ format: 'png' | 'jpeg'; quality?: number }>;
}

export interface CaptureLimits {
  readonly maxNodesPerFrame: number;
  readonly maxDepth: number;
  readonly maxSnapshotBytes: number;
  readonly timeoutMs: number;
}

export type ConsistencyOptions =
  | Readonly<{ mode: 'best-effort' }>
  | Readonly<{ mode: 'verify'; retries: number; settleMs: number }>;

export type DataPolicy =
  | Readonly<{ mode: 'lossless' }>
  | Readonly<{
      mode: 'redact';
      inputValues?: boolean;
      text?: readonly string[];
      attributes?: readonly string[];
      replacement?: string;
    }>;

export interface CaptureConfig<TAdapterOptions = unknown> {
  readonly scope: SnapshotScope;
  readonly features: CaptureFeatures;
  readonly limits: CaptureLimits;
  readonly consistency: ConsistencyOptions;
  readonly data: DataPolicy;
  readonly adapter?: TAdapterOptions;
}

export interface CaptureSettings<TAdapterOptions = unknown> {
  readonly scope?: SnapshotScope;
  readonly features?: Partial<{
    dom: Partial<DomFeatureOptions>;
    layout: false | Partial<LayoutFeatureOptions>;
    frames: false | Partial<FrameFeatureOptions>;
    interaction: false | Partial<InteractionFeatureOptions>;
    accessibility: false | Partial<{ relationships: boolean; tree: boolean }>;
    pixels: false | Partial<{ format: 'png' | 'jpeg'; quality: number }>;
  }>;
  readonly limits?: Partial<CaptureLimits>;
  readonly consistency?: ConsistencyOptions;
  readonly data?: DataPolicy;
  readonly adapter?: TAdapterOptions;
}

export interface CaptureOverrides<TAdapterOptions = unknown> extends CaptureSettings<TAdapterOptions> {
  readonly signal?: AbortSignal;
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = Object.freeze({
  scope: Object.freeze({ mode: 'document' as CaptureMode }),
  features: Object.freeze({
    dom: Object.freeze({ comments: true, shadowRoots: 'open' as const, templates: true }),
    layout: Object.freeze({ geometry: true, computedStyles: 'minimal' as const }),
    frames: Object.freeze({ crossOrigin: true, maxFrames: 128 }),
    interaction: Object.freeze({ focus: true, selection: true, pointer: true, formState: true, scroll: true }),
    accessibility: Object.freeze({ relationships: true, tree: false }),
    pixels: false
  }),
  limits: Object.freeze({ maxNodesPerFrame: 100_000, maxDepth: 2_048, maxSnapshotBytes: 64 * 1024 * 1024, timeoutMs: 30_000 }),
  consistency: Object.freeze({ mode: 'verify' as const, retries: 2, settleMs: 16 }),
  data: Object.freeze({ mode: 'lossless' as const })
});

export function defineConfig<const TConfig extends CaptureSettings>(config: TConfig): TConfig {
  return config;
}
