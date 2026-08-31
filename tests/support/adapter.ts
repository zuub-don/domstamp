import type { Page } from '@playwright/test';
import { createDomstamp, type DomSnapshot } from 'domstamp';
import { playwrightAdapter, type PlaywrightCaptureOptions as CaptureOptions } from '@domstamp/playwright';

export interface SnapshotAdapter {
  readonly name: string;
  capture(page: Page, options?: CaptureOptions): Promise<DomSnapshot>;
}

const productionClient = createDomstamp(playwrightAdapter());
const referenceAdapter: SnapshotAdapter = {
  name: 'domstamp-playwright',
  capture: (page, options = {}) => productionClient.capture(page, {
    scope: {
      mode: options.mode ?? 'document',
      ...(options.root === undefined ? {} : { root: options.root })
    },
    limits: {
      ...(options.maxNodesPerFrame === undefined ? {} : { maxNodesPerFrame: options.maxNodesPerFrame }),
      ...(options.maxDepth === undefined ? {} : { maxDepth: options.maxDepth })
    }
  })
};

export async function loadAdapter(): Promise<SnapshotAdapter> {
  const modulePath = process.env.DOMSTAMP_ADAPTER_MODULE;
  if (!modulePath) return referenceAdapter;

  const imported = await import(modulePath) as { default?: SnapshotAdapter; adapter?: SnapshotAdapter };
  const adapter = imported.default ?? imported.adapter;
  if (!adapter || typeof adapter.capture !== 'function') {
    throw new Error(`${modulePath} must export a default adapter or named adapter with capture(page, options)`);
  }
  return adapter;
}
