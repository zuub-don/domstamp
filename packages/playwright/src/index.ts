import type { AdapterCapability, AdapterContext, DomstampAdapter, DomSnapshot } from 'domstamp';
import type { Page } from 'playwright-core';
import { capturePlaywrightSnapshot } from './walker.js';

export interface PlaywrightAdapterOptions {
  /** Override the minimal computed-style property list used by the walker. */
  readonly computedStyleProperties?: readonly string[];
}

const capabilities = [
  'cross-origin-frames',
  'dom',
  'frames',
  'interaction',
  'layout',
  'mutation-consistency',
  'open-shadow-roots'
] as const satisfies readonly AdapterCapability[];

export function playwrightAdapter(): DomstampAdapter<Page, PlaywrightAdapterOptions> {
  return Object.freeze({
    name: '@domstamp/playwright',
    version: '0.1.0',
    capabilities: new Set(capabilities),
    async capture(page: Page, { config, signal }: AdapterContext<PlaywrightAdapterOptions>): Promise<DomSnapshot> {
      if (signal.aborted) throw signal.reason;
      const root = 'root' in config.scope ? config.scope.root : undefined;
      const layout = config.features.layout;
      const interaction = config.features.interaction;
      const frameOptions = config.features.frames;
      const configuredStyles = config.adapter?.computedStyleProperties;
      const styleSelection = layout === false ? [] : layout.computedStyles;
      const snapshot = await capturePlaywrightSnapshot(page, {
        ...(root === undefined ? {} : { root }),
        mode: config.scope.mode,
        maxNodesPerFrame: config.limits.maxNodesPerFrame,
        maxDepth: config.limits.maxDepth,
        includeComments: config.features.dom.comments,
        includeShadowRoots: config.features.dom.shadowRoots !== 'none',
        includeTemplates: config.features.dom.templates,
        captureGeometry: layout !== false && layout.geometry,
        captureStyles: layout !== false,
        ...(configuredStyles !== undefined
          ? { styleProperties: configuredStyles }
          : Array.isArray(styleSelection)
            ? { styleProperties: styleSelection }
            : {}),
        allStyleProperties: styleSelection === 'all',
        captureFocus: interaction !== false && interaction.focus,
        captureSelection: interaction !== false && interaction.selection,
        captureFormState: interaction !== false && interaction.formState,
        captureScroll: interaction !== false && interaction.scroll,
        capturePointer: interaction !== false && interaction.pointer,
        captureReferences: config.features.accessibility !== false && config.features.accessibility.relationships,
        viewportMargin: config.scope.mode === 'viewport' ? (config.scope.margin ?? 0) : 0,
        focusSiblingCount: config.scope.mode === 'focus' ? (config.scope.siblingCount ?? 1) : 1,
        focusIncludeReferences: config.scope.mode === 'focus' ? (config.scope.includeReferences ?? true) : true,
        frames: frameOptions === false
          ? false
          : { crossOrigin: frameOptions.crossOrigin, maxFrames: frameOptions.maxFrames }
      });
      if (signal.aborted) throw signal.reason;
      return snapshot;
    }
  });
}

export { capturePlaywrightSnapshot } from './walker.js';
export type { CaptureOptions as PlaywrightCaptureOptions } from './walker.js';
