import { expect, test } from '@playwright/test';
import { chromium } from 'playwright-core';
import puppeteer from 'puppeteer-core';
import { createDomstamp, runAdapterConformance } from 'domstamp';
import { puppeteerAdapter } from '@domstamp/puppeteer';

test.describe('@conformance Puppeteer adapter', () => {
  test('a real Puppeteer session satisfies the shared DOM and cross-origin frame contract', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Puppeteer adapter is exercised once with the pinned Chromium binary');
    test.setTimeout(120_000);
    const browser = await puppeteer.launch({
      executablePath: chromium.executablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      const baseUrl = process.env.GYM_BASE_URL ?? 'http://127.0.0.1:4173';
      await page.goto(`${baseUrl}/scenario/frames?seed=121`, { waitUntil: 'load' });
      const adapter = puppeteerAdapter();
      const client = createDomstamp(adapter);
      const snapshot = await client.capture(page);

      expect(snapshot.documents).toHaveLength(3);
      expect(snapshot.documents.filter((document) =>
        document.nodes.some((node) => node.name === 'input'))).toHaveLength(2);
      expect(client.adapter.capabilities.has('cross-origin-frames')).toBe(true);
      expect(client.adapter.capabilities.has('pixels')).toBe(false);

      const report = await runAdapterConformance(adapter, {
        createTarget: () => page,
        canonicalize: (captured) => captured
      });
      expect(report).toMatchObject({ deterministic: true, documentCount: 1 });
    } finally {
      await browser.close();
    }
  });
});
