import type { AdapterCapability, AdapterContext, DomSnapshot, DomstampAdapter } from 'domstamp';
import type { Page as PuppeteerPage } from 'puppeteer-core';
import { capturePlaywrightSnapshot } from '@domstamp/playwright';
import type { Page as PlaywrightPage } from 'playwright-core';

export interface PuppeteerAdapterOptions {
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

/**
 * Captures Puppeteer's Page through the shared, driver-structural DOM walker.
 * Accessibility YAML and masked pixel evidence remain Playwright-only today,
 * so this adapter does not advertise those capabilities.
 */
export function puppeteerAdapter(): DomstampAdapter<PuppeteerPage, PuppeteerAdapterOptions> {
  return Object.freeze({
    name: '@domstamp/puppeteer',
    version: '0.2.0',
    capabilities: new Set(capabilities),
    defaults: {
      features: { accessibility: false as const, pixels: false as const }
    },
    async capture(
      page: PuppeteerPage,
      { config, signal }: AdapterContext<PuppeteerAdapterOptions>
    ): Promise<DomSnapshot> {
      if (signal.aborted) throw signal.reason;
      const root = 'root' in config.scope ? config.scope.root : undefined;
      const layout = config.features.layout;
      const interaction = config.features.interaction;
      const frameOptions = config.features.frames;
      const styleSelection = layout === false ? [] : layout.computedStyles;
      const configuredStyles = config.adapter?.computedStyleProperties;
      const snapshot = await capturePlaywrightSnapshot(page as unknown as PlaywrightPage, {
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
        signal,
        frames: frameOptions === false
          ? false
          : { crossOrigin: frameOptions.crossOrigin, maxFrames: frameOptions.maxFrames }
      });
      if (signal.aborted) throw signal.reason;
      return snapshot;
    }
  });
}
