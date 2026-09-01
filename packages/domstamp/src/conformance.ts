import type { DomstampAdapter } from './adapter.js';
import { DomstampError } from './errors.js';
import type { DomSnapshot } from './schema.js';
import { validateSnapshot, type SnapshotValidationLimits } from './client.js';

export interface AdapterConformanceOptions<TTarget> {
  /** Creates a target in a known, quiescent state. Called once per run. */
  readonly createTarget: () => TTarget | Promise<TTarget>;
  /** Optional target cleanup, even when capture or validation fails. */
  readonly disposeTarget?: (target: TTarget) => void | Promise<void>;
  /** Overrides structural validation ceilings for unusually large fixtures. */
  readonly limits?: SnapshotValidationLimits;
  /** Canonicalizer for driver-specific evidence such as pixels or native AX IDs. */
  readonly canonicalize?: (snapshot: DomSnapshot) => unknown;
}

export interface AdapterConformanceReport {
  readonly adapter: Readonly<{ name: string; version: string }>;
  readonly capabilities: readonly string[];
  readonly deterministic: true;
  readonly documentCount: number;
  readonly nodeCount: number;
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (cause) {
    throw new DomstampError('INVALID_SNAPSHOT', 'Conformance canonical output must be JSON-serializable', { cause });
  }
}

/**
 * Driver-neutral smoke suite for adapter authors. It checks public metadata,
 * validates two captures, and proves a quiescent target is deterministic.
 */
export async function runAdapterConformance<TTarget, TAdapterOptions = unknown>(
  adapter: DomstampAdapter<TTarget, TAdapterOptions>,
  options: AdapterConformanceOptions<TTarget>
): Promise<AdapterConformanceReport> {
  if (!adapter.name.trim() || !adapter.version.trim()) {
    throw new DomstampError('INVALID_CONFIG', 'Adapter conformance requires non-empty name and version metadata');
  }
  if (!adapter.capabilities.has('dom')) {
    throw new DomstampError('UNSUPPORTED_CAPABILITY', 'A conforming Domstamp adapter must implement the dom capability');
  }
  const target = await options.createTarget();
  const controller = new AbortController();
  try {
    // The adapter receives a deliberately minimal, capability-safe contract.
    // Richer feature packs are exercised by the browser gym.
    const config = {
      scope: { mode: 'document' as const },
      features: {
        dom: { comments: true, shadowRoots: 'none' as const, templates: true },
        layout: false as const,
        frames: false as const,
        interaction: false as const,
        accessibility: false as const,
        pixels: false as const
      },
      limits: { maxNodesPerFrame: 100_000, maxDepth: 2_048, maxSnapshotBytes: 64 * 1024 * 1024, timeoutMs: 30_000 },
      consistency: { mode: 'best-effort' as const },
      data: { mode: 'lossless' as const }
    };
    const first = await adapter.capture(target, { config, signal: controller.signal });
    validateSnapshot(first, options.limits);
    const second = await adapter.capture(target, { config, signal: controller.signal });
    validateSnapshot(second, options.limits);
    const canonicalize = options.canonicalize ?? ((snapshot: DomSnapshot) => snapshot);
    if (stableJson(canonicalize(second)) !== stableJson(canonicalize(first))) {
      throw new DomstampError('INVALID_SNAPSHOT', 'Adapter is not deterministic for a quiescent target', {
        details: { adapter: adapter.name }
      });
    }
    return Object.freeze({
      adapter: Object.freeze({ name: adapter.name, version: adapter.version }),
      capabilities: Object.freeze([...adapter.capabilities].sort()),
      deterministic: true as const,
      documentCount: first.documents.length,
      nodeCount: first.documents.reduce((total, document) => total + document.nodes.length, 0)
    });
  } finally {
    controller.abort();
    await options.disposeTarget?.(target);
  }
}
