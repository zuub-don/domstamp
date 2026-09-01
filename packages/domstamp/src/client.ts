import type { AdapterCapability, CaptureResult, DomstampAdapter, DomstampPlugin, PluginContext } from './adapter.js';
import { DEFAULT_CAPTURE_CONFIG, type CaptureConfig, type CaptureOverrides, type CaptureSettings } from './config.js';
import { DomstampError } from './errors.js';
import { redactSnapshot } from './redaction.js';
import { SNAPSHOT_FORMAT, SNAPSHOT_SCHEMA_VERSION, type DomSnapshot } from './schema.js';

export interface DomstampOptions<TTarget, TAdapterOptions = unknown> {
  readonly defaults?: CaptureSettings<TAdapterOptions>;
  readonly plugins?: readonly DomstampPlugin<TTarget, TAdapterOptions>[];
  readonly now?: () => number;
}

export interface Domstamp<TTarget, TAdapterOptions = unknown> {
  readonly adapter: Readonly<{ name: string; version: string; capabilities: ReadonlySet<AdapterCapability> }>;
  capture(target: TTarget, overrides?: CaptureOverrides<TAdapterOptions>): Promise<DomSnapshot>;
  captureDetailed(target: TTarget, overrides?: CaptureOverrides<TAdapterOptions>): Promise<CaptureResult>;
  withDefaults(overrides: CaptureSettings<TAdapterOptions>): Domstamp<TTarget, TAdapterOptions>;
}

const mergeEnabledFeature = <T extends object>(
  base: T | false,
  override: Partial<T> | false | undefined,
  fallback: T
): T | false => {
  if (override === false) return false;
  if (override === undefined) return base;
  if (base === false) return { ...fallback, ...override };
  return { ...base, ...override };
};

function resolveConfig<TAdapterOptions>(
  base: CaptureConfig<TAdapterOptions>,
  overrides: CaptureSettings<TAdapterOptions> = {}
): CaptureConfig<TAdapterOptions> {
  const featureOverrides = overrides.features;
  const safeDefaults = DEFAULT_CAPTURE_CONFIG.features;
  const layout = mergeEnabledFeature(base.features.layout, featureOverrides?.layout, safeDefaults.layout || { geometry: true, computedStyles: 'minimal' });
  const frames = mergeEnabledFeature(base.features.frames, featureOverrides?.frames, safeDefaults.frames || { crossOrigin: true, maxFrames: 128 });
  const interaction = mergeEnabledFeature(base.features.interaction, featureOverrides?.interaction, safeDefaults.interaction || {
    focus: true, selection: true, pointer: true, formState: true, scroll: true
  });
  const accessibility = mergeEnabledFeature(base.features.accessibility, featureOverrides?.accessibility, safeDefaults.accessibility || {
    relationships: true, tree: false
  });
  const pixels = mergeEnabledFeature(base.features.pixels, featureOverrides?.pixels, {
    format: 'png', fullPage: false, scale: 'css'
  });
  const data = overrides.data ?? base.data;
  const config: CaptureConfig<TAdapterOptions> = Object.freeze({
    scope: Object.freeze({ ...(overrides.scope ?? base.scope) }),
    features: Object.freeze({
      dom: Object.freeze({ ...base.features.dom, ...featureOverrides?.dom }),
      layout: layout === false ? false : Object.freeze({
        ...layout,
        computedStyles: Array.isArray(layout.computedStyles)
          ? Object.freeze([...layout.computedStyles] as string[])
          : layout.computedStyles as 'minimal' | 'all'
      }),
      frames: frames === false ? false : Object.freeze({ ...frames }),
      interaction: interaction === false ? false : Object.freeze({ ...interaction }),
      accessibility: accessibility === false ? false : Object.freeze({ ...accessibility }),
      pixels: pixels === false ? false : Object.freeze({ ...pixels })
    }),
    limits: Object.freeze({ ...base.limits, ...overrides.limits }),
    consistency: Object.freeze({ ...(overrides.consistency ?? base.consistency) }),
    data: Object.freeze(data.mode === 'lossless' ? { mode: 'lossless' } : {
      ...data,
      ...(data.text === undefined ? {} : { text: Object.freeze([...data.text]) }),
      ...(data.attributes === undefined ? {} : { attributes: Object.freeze([...data.attributes]) }),
      ...(data.pixelMasks === undefined ? {} : { pixelMasks: Object.freeze([...data.pixelMasks]) })
    }),
    ...(overrides.adapter !== undefined
      ? { adapter: overrides.adapter }
      : base.adapter !== undefined
        ? { adapter: base.adapter }
        : {})
  });
  validateConfig(config);
  return config;
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomstampError('INVALID_CONFIG', `${name} must be a positive safe integer`, { details: { name, value } });
  }
}

export function validateConfig(config: CaptureConfig): void {
  validatePositiveInteger('limits.maxNodesPerFrame', config.limits.maxNodesPerFrame);
  validatePositiveInteger('limits.maxDepth', config.limits.maxDepth);
  validatePositiveInteger('limits.maxSnapshotBytes', config.limits.maxSnapshotBytes);
  validatePositiveInteger('limits.timeoutMs', config.limits.timeoutMs);
  if (config.features.frames !== false) validatePositiveInteger('features.frames.maxFrames', config.features.frames.maxFrames);
  if (config.scope.mode === 'viewport' && config.scope.margin !== undefined && (!Number.isFinite(config.scope.margin) || config.scope.margin < 0)) {
    throw new DomstampError('INVALID_CONFIG', 'scope.margin must be a finite non-negative number');
  }
  if (config.consistency.mode === 'verify') {
    if (!Number.isSafeInteger(config.consistency.retries) || config.consistency.retries < 0) {
      throw new DomstampError('INVALID_CONFIG', 'consistency.retries must be a non-negative safe integer');
    }
    if (!Number.isFinite(config.consistency.settleMs) || config.consistency.settleMs < 0) {
      throw new DomstampError('INVALID_CONFIG', 'consistency.settleMs must be a finite non-negative number');
    }
  }
  if (config.scope.mode === 'focus') {
    if (config.scope.siblingCount !== undefined && (!Number.isSafeInteger(config.scope.siblingCount) || config.scope.siblingCount < 0)) {
      throw new DomstampError('INVALID_CONFIG', 'scope.siblingCount must be a non-negative safe integer');
    }
  }
  if (config.features.pixels !== false && config.features.pixels.format === 'jpeg' && config.features.pixels.quality !== undefined) {
    if (!Number.isInteger(config.features.pixels.quality) || config.features.pixels.quality < 0 || config.features.pixels.quality > 100) {
      throw new DomstampError('INVALID_CONFIG', 'JPEG quality must be an integer from 0 through 100');
    }
  }
  if (config.data.mode === 'redact') {
    for (const [name, values] of [['data.text', config.data.text], ['data.attributes', config.data.attributes], ['data.pixelMasks', config.data.pixelMasks]] as const) {
      if (values !== undefined && values.some((value) => typeof value !== 'string' || value.length === 0)) {
        throw new DomstampError('INVALID_CONFIG', `${name} entries must be non-empty strings`);
      }
    }
    if (config.data.replacement !== undefined && config.data.replacement.length === 0) {
      throw new DomstampError('INVALID_CONFIG', 'data.replacement must not be empty');
    }
    if (config.features.pixels !== false && (!config.data.pixelMasks || config.data.pixelMasks.length === 0)) {
      throw new DomstampError('INVALID_CONFIG', 'Redacted pixel capture requires at least one data.pixelMasks selector');
    }
  }
}

function requiredCapabilities(config: CaptureConfig): AdapterCapability[] {
  const required: AdapterCapability[] = ['dom'];
  if (config.features.dom.shadowRoots !== 'none') required.push('open-shadow-roots');
  if (config.features.dom.shadowRoots === 'all-available') required.push('closed-shadow-roots');
  if (config.features.layout !== false) required.push('layout');
  if (config.features.frames !== false) {
    required.push('frames');
    if (config.features.frames.crossOrigin) required.push('cross-origin-frames');
  }
  if (config.features.interaction !== false) required.push('interaction');
  if (config.features.accessibility !== false && config.features.accessibility.tree) required.push('accessibility-tree');
  if (config.features.pixels !== false) required.push('pixels');
  if (config.consistency.mode === 'verify') required.push('mutation-consistency');
  if (config.data.mode === 'redact' && config.features.pixels !== false) required.push('redaction');
  return required;
}

function invalidSnapshot(message: string): never {
  throw new DomstampError('INVALID_SNAPSHOT', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateParentGraph(
  entries: ReadonlyMap<string | number, string | number | null>,
  label: string
): void {
  const complete = new Set<string | number>();
  for (const start of entries.keys()) {
    if (complete.has(start)) continue;
    const path: Array<string | number> = [];
    const inPath = new Set<string | number>();
    let current: string | number | null = start;
    while (current !== null && entries.has(current) && !complete.has(current)) {
      if (inPath.has(current)) invalidSnapshot(`${label} parent graph contains a cycle at ${String(current)}`);
      inPath.add(current);
      path.push(current);
      current = entries.get(current) ?? null;
    }
    for (const entry of path) complete.add(entry);
  }
}

export interface SnapshotValidationLimits {
  readonly maxDocuments?: number;
  readonly maxNodesPerDocument?: number;
  readonly maxDepth?: number;
}

export function validateSnapshot(
  snapshot: unknown,
  limits: SnapshotValidationLimits = {}
): asserts snapshot is DomSnapshot {
  if (!isRecord(snapshot) || snapshot.format !== SNAPSHOT_FORMAT || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION || !Array.isArray(snapshot.documents)) {
    throw new DomstampError('INVALID_SNAPSHOT', 'Adapter returned an unsupported snapshot schema', {
      details: {
        format: isRecord(snapshot) ? snapshot.format : undefined,
        schemaVersion: isRecord(snapshot) ? snapshot.schemaVersion : undefined
      }
    });
  }
  if (limits.maxDocuments !== undefined && snapshot.documents.length > limits.maxDocuments) {
    invalidSnapshot(`Snapshot contains ${snapshot.documents.length} documents; limit is ${limits.maxDocuments}`);
  }
  if (typeof snapshot.framesTruncated !== 'boolean') invalidSnapshot('framesTruncated must be a boolean');
  if (!Array.isArray(snapshot.accessibility)) invalidSnapshot('accessibility must be an array');
  if (!Array.isArray(snapshot.attachments)) invalidSnapshot('attachments must be an array');
  if (snapshot.viewport !== null && (!isRecord(snapshot.viewport)
    || !isFiniteNumber(snapshot.viewport.width) || snapshot.viewport.width < 0
    || !isFiniteNumber(snapshot.viewport.height) || snapshot.viewport.height < 0)) {
    invalidSnapshot('viewport must contain finite, non-negative dimensions');
  }
  if (snapshot.pointer !== null && (!isRecord(snapshot.pointer)
    || !isFiniteNumber(snapshot.pointer.x) || !isFiniteNumber(snapshot.pointer.y)
    || typeof snapshot.pointer.type !== 'string'
    || !Number.isSafeInteger(snapshot.pointer.buttons) || (snapshot.pointer.buttons as number) < 0)) {
    invalidSnapshot('pointer is invalid');
  }
  const frameIds = new Set<string>();
  const frameParents = new Map<string, string | null>();
  for (const document of snapshot.documents) {
    if (!isRecord(document) || typeof document.frameId !== 'string' || !document.frameId || frameIds.has(document.frameId)) {
      invalidSnapshot(`Duplicate, empty, or invalid frame ID: ${isRecord(document) ? String(document.frameId) : '<missing>'}`);
    }
    frameIds.add(document.frameId);
    if (document.parentFrameId !== null && typeof document.parentFrameId !== 'string') invalidSnapshot(`${document.frameId} has an invalid parent frame ID`);
    if (document.parentFrameId === document.frameId) invalidSnapshot(`${document.frameId} cannot be its own parent frame`);
    if ((document.ownerPath !== null && typeof document.ownerPath !== 'string')
      || typeof document.url !== 'string' || typeof document.origin !== 'string'
      || typeof document.title !== 'string' || typeof document.frameName !== 'string'
      || !['document', 'viewport', 'focus'].includes(String(document.mode))) {
      invalidSnapshot(`${document.frameId} has invalid document metadata`);
    }
    frameParents.set(document.frameId, document.parentFrameId);
    if (!Array.isArray(document.nodes)) invalidSnapshot(`${document.frameId} nodes must be an array`);
    if (limits.maxNodesPerDocument !== undefined && document.nodes.length > limits.maxNodesPerDocument) {
      invalidSnapshot(`${document.frameId} contains ${document.nodes.length} nodes; limit is ${limits.maxNodesPerDocument}`);
    }
    if (!isRecord(document.scroll) || !isFiniteNumber(document.scroll.x) || !isFiniteNumber(document.scroll.y)) {
      invalidSnapshot(`${document.frameId} has invalid scroll coordinates`);
    }
    if (!isRecord(document.truncated) || typeof document.truncated.nodes !== 'boolean' || typeof document.truncated.depth !== 'boolean') {
      invalidSnapshot(`${document.frameId} has invalid truncation metadata`);
    }
    if (!isRecord(document.consistency)
      || !['stable', 'unstable', 'detached', 'error'].includes(String(document.consistency.status))
      || (document.consistency.epochStart !== null && !isFiniteNumber(document.consistency.epochStart))
      || (document.consistency.epochEnd !== null && !isFiniteNumber(document.consistency.epochEnd))) {
      invalidSnapshot(`${document.frameId} has invalid consistency metadata`);
    }
    const nodeIds = new Set<number>();
    const nodePaths = new Set<string>();
    const nodeParents = new Map<number, number | null>();
    for (const node of document.nodes) {
      if (!isRecord(node) || !Number.isSafeInteger(node.id) || (node.id as number) < 0 || nodeIds.has(node.id as number)) {
        invalidSnapshot(`Invalid or duplicate node ID ${isRecord(node) ? String(node.id) : '<missing>'} in ${document.frameId}`);
      }
      const nodeId = node.id as number;
      nodeIds.add(nodeId);
      if (node.parent !== null && (!Number.isSafeInteger(node.parent) || (node.parent as number) < 0)) {
        invalidSnapshot(`Node ${nodeId} has an invalid parent`);
      }
      if (node.parent === nodeId) invalidSnapshot(`Node ${nodeId} cannot be its own parent`);
      nodeParents.set(nodeId, node.parent as number | null);
      if (!Number.isSafeInteger(node.depth) || (node.depth as number) < 0) invalidSnapshot(`Node ${nodeId} has an invalid depth`);
      if (limits.maxDepth !== undefined && (node.depth as number) > limits.maxDepth) {
        invalidSnapshot(`Node ${nodeId} exceeds the configured depth limit`);
      }
      if (typeof node.path !== 'string' || !node.path || nodePaths.has(node.path)) invalidSnapshot(`Node ${nodeId} has an empty or duplicate path`);
      nodePaths.add(node.path);
      if (typeof node.kind !== 'string' || !node.kind || typeof node.name !== 'string'
        || (node.namespace !== null && typeof node.namespace !== 'string')
        || (node.value !== null && typeof node.value !== 'string')) {
        invalidSnapshot(`Node ${nodeId} has invalid identity fields`);
      }
      if (!Array.isArray(node.attributes) || !node.attributes.every((entry) => Array.isArray(entry)
        && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'string')) {
        invalidSnapshot(`Node ${nodeId} has invalid attributes`);
      }
      if (!Array.isArray(node.references)) invalidSnapshot(`Node ${nodeId} references must be an array`);
      if (!isRecord(node.state) || !Object.values(node.state).every((value) => value === null
        || typeof value === 'boolean' || typeof value === 'string' || isFiniteNumber(value))) {
        invalidSnapshot(`Node ${nodeId} has invalid runtime state`);
      }
      if (!isRecord(node.style) || !Object.values(node.style).every((value) => typeof value === 'string')) {
        invalidSnapshot(`Node ${nodeId} has invalid computed styles`);
      }
      if (node.rect !== null && (!isRecord(node.rect)
        || !isFiniteNumber(node.rect.x) || !isFiniteNumber(node.rect.y)
        || !isFiniteNumber(node.rect.width) || node.rect.width < 0
        || !isFiniteNumber(node.rect.height) || node.rect.height < 0)) {
        invalidSnapshot(`Node ${nodeId} has invalid geometry`);
      }
    }
    for (const node of document.nodes) {
      const typedNode = node as unknown as DomSnapshot['documents'][number]['nodes'][number];
      if (typedNode.parent !== null && !nodeIds.has(typedNode.parent)) {
        invalidSnapshot(`Node ${typedNode.id} has an unresolved parent ${typedNode.parent}`);
      }
      for (const reference of typedNode.references) {
        if (!isRecord(reference) || typeof reference.kind !== 'string' || typeof reference.value !== 'string') {
          invalidSnapshot(`Node ${typedNode.id} has an invalid reference`);
        }
        if (reference.target !== null && !nodeIds.has(reference.target)) {
          invalidSnapshot(`Node ${typedNode.id} has an unresolved ${reference.kind} reference`);
        }
      }
    }
    validateParentGraph(nodeParents, `${document.frameId} node`);
    if (document.activeNode !== null && (!Number.isSafeInteger(document.activeNode) || !nodeIds.has(document.activeNode as number))) {
      invalidSnapshot(`${document.frameId} has an unresolved active node`);
    }
    if (document.selection !== null) {
      if (!isRecord(document.selection)) invalidSnapshot(`${document.frameId} has an invalid selection`);
      if (typeof document.selection.direction !== 'string') invalidSnapshot(`${document.frameId} selection has an invalid direction`);
      for (const key of ['anchorNode', 'focusNode'] as const) {
        const selected = document.selection[key];
        if (selected !== null && (!Number.isSafeInteger(selected) || !nodeIds.has(selected as number))) {
          invalidSnapshot(`${document.frameId} selection has an unresolved ${key}`);
        }
      }
      for (const key of ['anchorOffset', 'focusOffset'] as const) {
        const offset = document.selection[key];
        if (!Number.isSafeInteger(offset) || (offset as number) < 0) invalidSnapshot(`${document.frameId} selection has an invalid ${key}`);
      }
    }
  }
  for (const document of snapshot.documents) {
    const typedDocument = document as unknown as DomSnapshot['documents'][number];
    if (typedDocument.parentFrameId !== null && !frameIds.has(typedDocument.parentFrameId)) {
      invalidSnapshot(`${typedDocument.frameId} has an unresolved parent frame`);
    }
  }
  const accessibilityFrames = new Set<string>();
  for (const tree of snapshot.accessibility) {
    if (!isRecord(tree) || typeof tree.frameId !== 'string' || !frameIds.has(tree.frameId)
      || accessibilityFrames.has(tree.frameId)) {
      invalidSnapshot('Accessibility tree has an invalid or duplicate frameId');
    }
    accessibilityFrames.add(tree.frameId);
    if (!['aria-snapshot', 'native'].includes(String(tree.source)) || typeof tree.truncated !== 'boolean'
      || !Array.isArray(tree.nodes)) {
      invalidSnapshot(`Accessibility tree for ${tree.frameId} is invalid`);
    }
    const nodeIds = new Set<string>();
    const parents = new Map<string, string | null>();
    for (const node of tree.nodes) {
      if (!isRecord(node) || typeof node.id !== 'string' || !node.id || nodeIds.has(node.id)
        || (node.parent !== null && typeof node.parent !== 'string')
        || typeof node.role !== 'string' || !node.role || typeof node.name !== 'string'
        || (node.description !== null && typeof node.description !== 'string')
        || (node.value !== null && typeof node.value !== 'string')
        || (node.domPath !== null && typeof node.domPath !== 'string')
        || !isRecord(node.states)
        || !Object.values(node.states).every((value) => value === null || typeof value === 'boolean'
          || typeof value === 'string' || isFiniteNumber(value))) {
        invalidSnapshot(`Accessibility tree for ${tree.frameId} contains an invalid node`);
      }
      if (node.parent === node.id) invalidSnapshot(`Accessibility node ${node.id} cannot be its own parent`);
      nodeIds.add(node.id);
      parents.set(node.id, node.parent as string | null);
    }
    for (const [nodeId, parent] of parents) {
      if (parent !== null && !nodeIds.has(parent)) invalidSnapshot(`Accessibility node ${nodeId} has an unresolved parent`);
    }
    if (tree.root !== null && (typeof tree.root !== 'string' || !nodeIds.has(tree.root))) {
      invalidSnapshot(`Accessibility tree for ${tree.frameId} has an unresolved root`);
    }
    validateParentGraph(parents, `${tree.frameId} accessibility`);
  }
  const attachmentIds = new Set<string>();
  for (const attachment of snapshot.attachments) {
    if (!isRecord(attachment) || typeof attachment.id !== 'string' || !attachment.id || attachmentIds.has(attachment.id)
      || attachment.kind !== 'screenshot'
      || (attachment.frameId !== null && (typeof attachment.frameId !== 'string' || !frameIds.has(attachment.frameId)))
      || !['image/jpeg', 'image/png'].includes(String(attachment.mediaType))
      || attachment.encoding !== 'base64' || typeof attachment.data !== 'string'
      || !Number.isSafeInteger(attachment.byteLength) || (attachment.byteLength as number) < 0
      || typeof attachment.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(attachment.sha256)
      || !Number.isSafeInteger(attachment.width) || (attachment.width as number) < 0
      || !Number.isSafeInteger(attachment.height) || (attachment.height as number) < 0) {
      invalidSnapshot('Snapshot contains an invalid attachment');
    }
    const normalized = attachment.data.replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
      invalidSnapshot(`Attachment ${attachment.id} contains invalid base64 data`);
    }
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    const decodedLength = normalized.length === 0 ? 0 : Math.floor(normalized.length * 3 / 4) - padding;
    if (decodedLength !== attachment.byteLength) invalidSnapshot(`Attachment ${attachment.id} byteLength does not match its data`);
    attachmentIds.add(attachment.id);
  }
  validateParentGraph(frameParents, 'Frame');
}

function abortError(signal?: AbortSignal): DomstampError {
  return signal?.reason instanceof DomstampError
    ? signal.reason
    : new DomstampError('ABORTED', 'Capture was aborted');
}

function isInterruption(error: unknown): error is DomstampError {
  return error instanceof DomstampError && (error.code === 'ABORTED' || error.code === 'TIMEOUT');
}

async function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError(signal);
  return await new Promise<T>((resolve, reject) => {
    const aborted = () => reject(abortError(signal));
    signal.addEventListener('abort', aborted, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', aborted);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', aborted);
        reject(error);
      }
    );
  });
}

async function settle(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (milliseconds === 0) return;
  await withAbort(new Promise<void>((resolve) => setTimeout(resolve, milliseconds)), signal);
}

function snapshotBytes(snapshot: DomSnapshot): number {
  try {
    return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
  } catch (error) {
    throw new DomstampError('INVALID_SNAPSHOT', 'Snapshot must be JSON-serializable', { cause: error });
  }
}

export function createDomstamp<TTarget, TAdapterOptions = unknown>(
  adapter: DomstampAdapter<TTarget, TAdapterOptions>,
  options: DomstampOptions<TTarget, TAdapterOptions> = {}
): Domstamp<TTarget, TAdapterOptions> {
  const adapterDefaults = resolveConfig(
    DEFAULT_CAPTURE_CONFIG as CaptureConfig<TAdapterOptions>,
    adapter.defaults
  );
  const defaults = resolveConfig(adapterDefaults, options.defaults);
  const plugins = [...(options.plugins ?? [])];
  const pluginNames = new Set<string>();
  for (const plugin of plugins) {
    if (!plugin.name || pluginNames.has(plugin.name)) {
      throw new DomstampError('INVALID_CONFIG', `Plugin names must be non-empty and unique: ${plugin.name}`);
    }
    pluginNames.add(plugin.name);
  }
  if (!adapter.name || !adapter.version) throw new DomstampError('INVALID_CONFIG', 'Adapter name and version are required');
  const capabilities = new Set(adapter.capabilities);
  const now = options.now ?? (() => performance.now());

  const captureDetailed = async (
    target: TTarget,
    overrides: CaptureOverrides<TAdapterOptions> = {}
  ): Promise<CaptureResult> => {
    const config = resolveConfig(defaults, overrides);
    const missing = requiredCapabilities(config).filter((capability) => !capabilities.has(capability));
    if (missing.length) {
      throw new DomstampError('UNSUPPORTED_CAPABILITY', `${adapter.name} does not support: ${missing.join(', ')}`, {
        details: { adapter: adapter.name, missing }
      });
    }

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(
      new DomstampError('TIMEOUT', `Capture exceeded its ${config.limits.timeoutMs} ms timeout`, {
        details: { timeoutMs: config.limits.timeoutMs }
      })
    ), config.limits.timeoutMs);
    const signal = overrides.signal
      ? AbortSignal.any([overrides.signal, timeoutController.signal])
      : timeoutController.signal;
    const pluginContext: PluginContext<TTarget, TAdapterOptions> = {
      target,
      adapter: { name: adapter.name, version: adapter.version },
      config,
      signal
    };
    const start = now();
    const diagnostics: Array<{ level: 'info' | 'warning'; code: string; message: string; details: Readonly<Record<string, unknown>> }> = [];
    const snapshotLimits: SnapshotValidationLimits = {
      maxDocuments: config.features.frames === false ? 1 : config.features.frames.maxFrames,
      maxNodesPerDocument: config.limits.maxNodesPerFrame,
      maxDepth: config.limits.maxDepth
    };

    try {
      if (signal.aborted) throw abortError(signal);
      for (const plugin of plugins) {
        try {
          await withAbort(Promise.resolve(plugin.beforeCapture?.(pluginContext)), signal);
        } catch (error) {
          if (isInterruption(error)) throw error;
          throw new DomstampError('PLUGIN_FAILED', `Plugin ${plugin.name} failed in beforeCapture`, {
            cause: error,
            details: { plugin: plugin.name, hook: 'beforeCapture' }
          });
        }
      }
      if (signal.aborted) throw abortError(signal);

      let snapshot: DomSnapshot | undefined;
      const attempts = config.consistency.mode === 'verify' ? config.consistency.retries + 1 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        snapshot = await withAbort(adapter.capture(target, { config, signal }), signal);
        validateSnapshot(snapshot, snapshotLimits);
        const unstable = snapshot.documents.some((document) => document.consistency.status === 'unstable');
        if (!unstable || attempt === attempts - 1) {
          if (unstable) {
            diagnostics.push({
              level: 'warning',
              code: 'UNSTABLE_CAPTURE',
              message: `Snapshot remained unstable after ${attempt + 1} attempt(s)`,
              details: { attempts: attempt + 1 }
            });
          }
          break;
        }
        await settle(config.consistency.mode === 'verify' ? config.consistency.settleMs : 0, signal);
      }
      if (!snapshot) throw new DomstampError('CAPTURE_FAILED', 'Adapter did not return a snapshot');
      const initialBytes = snapshotBytes(snapshot);
      if (initialBytes > config.limits.maxSnapshotBytes) {
        throw new DomstampError('INVALID_SNAPSHOT', 'Snapshot exceeds limits.maxSnapshotBytes', {
          details: { actualBytes: initialBytes, maxBytes: config.limits.maxSnapshotBytes }
        });
      }
      if (config.data.mode === 'redact') {
        const redacted = redactSnapshot(snapshot, config.data);
        snapshot = redacted.snapshot;
        diagnostics.push({
          level: 'info',
          code: 'REDACTION_APPLIED',
          message: `Applied ${redacted.replacements} structural redaction replacement(s)`,
          details: { replacements: redacted.replacements }
        });
        validateSnapshot(snapshot, snapshotLimits);
      }
      for (const plugin of plugins) {
        if (!plugin.transform) continue;
        try {
          snapshot = await withAbort(Promise.resolve(plugin.transform(snapshot, pluginContext)), signal);
          validateSnapshot(snapshot, snapshotLimits);
        } catch (error) {
          if (isInterruption(error)) throw error;
          throw new DomstampError('PLUGIN_FAILED', `Plugin ${plugin.name} failed in transform`, {
            cause: error,
            details: { plugin: plugin.name, hook: 'transform' }
          });
        }
      }
      const transformedBytes = snapshotBytes(snapshot);
      if (transformedBytes > config.limits.maxSnapshotBytes) {
        throw new DomstampError('INVALID_SNAPSHOT', 'Transformed snapshot exceeds limits.maxSnapshotBytes', {
          details: { actualBytes: transformedBytes, maxBytes: config.limits.maxSnapshotBytes }
        });
      }

      const result: CaptureResult = {
        snapshot,
        adapter: { name: adapter.name, version: adapter.version },
        durationMs: Math.max(0, now() - start),
        diagnostics
      };
      for (const plugin of plugins) {
        try {
          await withAbort(Promise.resolve(plugin.afterCapture?.(result, pluginContext)), signal);
        } catch (error) {
          if (isInterruption(error)) throw error;
          throw new DomstampError('PLUGIN_FAILED', `Plugin ${plugin.name} failed in afterCapture`, {
            cause: error,
            details: { plugin: plugin.name, hook: 'afterCapture' }
          });
        }
      }
      return result;
    } catch (error) {
      for (const plugin of plugins) {
        try {
          await withAbort(Promise.resolve(plugin.onError?.(error, pluginContext)), signal);
        } catch {
          // Error hooks must never replace the original capture failure.
        }
      }
      if (error instanceof DomstampError) throw error;
      if (signal.aborted) throw abortError(signal);
      throw new DomstampError('CAPTURE_FAILED', `Capture failed in adapter ${adapter.name}`, {
        cause: error,
        details: { adapter: adapter.name }
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const client: Domstamp<TTarget, TAdapterOptions> = {
    adapter: { name: adapter.name, version: adapter.version, capabilities: new Set(capabilities) },
    capture: async (target, overrides) => (await captureDetailed(target, overrides)).snapshot,
    captureDetailed,
    withDefaults: (overrides) => createDomstamp(adapter, {
      defaults: resolveConfig(defaults, overrides),
      plugins,
      now
    })
  };
  return Object.freeze(client);
}
