import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { loadAdapter } from './support/adapter.js';
import { decodeTq1, encodeTq1 } from './support/tq1.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test.describe('@conformance snapshot contract', () => {
  test('every declared scenario is reachable', async ({ page, request }) => {
    const manifest = await request.get('/manifest.json');
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json() as { scenarios: string[] };
    expect(body.scenarios.length).toBeGreaterThanOrEqual(14);

    for (const scenario of body.scenarios) {
      const response = await page.goto(`/scenario/${scenario}?seed=41`);
      expect(response?.ok(), scenario).toBeTruthy();
      await expect(page.locator('body')).toHaveAttribute('data-scenario', scenario);
    }
  });

  test('identical state produces an identical semantic snapshot', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/document-kitchen-sink?seed=77');
    const first = await adapter.capture(page);
    await page.reload();
    const second = await adapter.capture(page);
    // Pointer devices may emit a synthetic move during navigation in some engines;
    // document semantics must remain byte-stable independently of that input event.
    expect(hash(second.documents)).toBe(hash(first.documents));
  });

  test('runtime form state, focus, and text selection survive capture', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/focus-and-forms?seed=9');
    const snapshot = await adapter.capture(page);
    const document = snapshot.documents[0]!;
    const active = document.nodes.find((node) => node.id === document.activeNode);
    const input = document.nodes.find((node) => node.attributes.some(([key, value]) => key === 'id' && value === 'name'));
    const checkbox = document.nodes.find((node) => node.attributes.some(([key, value]) => key === 'id' && value === 'enabled'));

    expect(active?.attributes).toContainEqual(['id', 'name']);
    expect(input?.state.value).toBe('runtime-9');
    expect(input?.state.selectionStart).toBe(2);
    expect(input?.state.selectionEnd).toBe(7);
    expect(input?.state.selectionDirection).toBe('forward');
    expect(checkbox?.state.indeterminate).toBe(true);
  });

  test('node references are closed and capture does not mutate the page', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/document-kitchen-sink?seed=14');
    await page.evaluate(() => {
      const instrumented = window as typeof window & { __captureMutations?: number };
      instrumented.__captureMutations = 0;
      new MutationObserver((records) => { instrumented.__captureMutations! += records.length; })
        .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    });

    const snapshot = await adapter.capture(page);
    for (const document of snapshot.documents) {
      const ids = new Set(document.nodes.map((node) => node.id));
      expect(ids.size).toBe(document.nodes.length);
      for (const node of document.nodes) {
        if (node.parent !== null) expect(ids.has(node.parent), `missing parent ${node.parent}`).toBe(true);
        for (const reference of node.references) {
          if (reference.target !== null) expect(ids.has(reference.target), `missing ${reference.kind} target`).toBe(true);
        }
      }
      if (document.activeNode !== null) expect(ids.has(document.activeNode)).toBe(true);
    }
    expect(await page.evaluate(() => (window as typeof window & { __captureMutations?: number }).__captureMutations)).toBe(0);
  });

  test('open shadow roots and deeply focused elements are represented', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/shadow-dom?seed=5');
    const document = (await adapter.capture(page)).documents[0]!;
    expect(document.nodes.some((node) => node.kind === 'shadow-root')).toBe(true);
    const active = document.nodes.find((node) => node.id === document.activeNode);
    expect(active?.attributes).toContainEqual(['id', 'shadow-action']);
  });

  test('nested shadow roots remain iterative and preserve deep focus', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/nested-shadow-dom?seed=6');
    const document = (await adapter.capture(page)).documents[0]!;
    expect(document.nodes.filter((node) => node.kind === 'shadow-root')).toHaveLength(2);
    const active = document.nodes.find((node) => node.id === document.activeNode);
    expect(active?.attributes).toContainEqual(['id', 'deep-shadow-action']);
    expect(active!.path).toContain('/s/');
  });

  test('focus scope retains ancestors, nearby context, and remote ARIA dependencies', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/focus-context?seed=44');
    const document = (await adapter.capture(page, { mode: 'focus', maxNodesPerFrame: 500 })).documents[0]!;
    const byId = (id: string) => document.nodes.find((node) => node.attributes.some(([key, value]) => key === 'id' && value === id));
    const focused = byId('focused-control');
    const remote = byId('remote-help');

    expect(document.mode).toBe('focus');
    expect(byId('task-context')).toBeDefined();
    expect(byId('nearby-before')).toBeDefined();
    expect(byId('nearby-after')).toBeDefined();
    expect(remote).toBeDefined();
    expect(document.nodes.some((node) => node.attributes.some(([key, value]) => key === 'data-noise' && value === '0'))).toBe(false);
    expect(focused?.references.find((reference) => reference.kind === 'aria-describedby')?.target).toBe(remote?.id);
  });

  test('viewport scope excludes distant and non-rendered branches', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/viewport-boundaries?seed=18');
    const document = (await adapter.capture(page, { mode: 'viewport' })).documents[0]!;
    const ids = document.nodes.flatMap((node) => node.attributes.filter(([key]) => key === 'id').map(([, value]) => value));
    expect(ids).toContain('visible-action');
    expect(ids).not.toContain('far-action');
    expect(ids).not.toContain('display-none');
  });

  test('same-origin and cross-origin browsing contexts are captured', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/frames?seed=12');
    await expect(page.locator('iframe')).toHaveCount(2);
    const snapshot = await adapter.capture(page);
    expect(snapshot.documents).toHaveLength(3);
    expect(snapshot.documents.filter((document) => document.nodes.some((node) => node.name === 'input'))).toHaveLength(2);
  });

  test('nested cross-origin frames form a closed ownership graph', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/nested-frames?seed=15');
    await expect.poll(() => page.frames().length).toBe(4);
    const snapshot = await adapter.capture(page);
    expect(snapshot.documents).toHaveLength(4);
    const documents = new Map(snapshot.documents.map((document) => [document.frameId, document]));

    for (const document of snapshot.documents.slice(1)) {
      expect(document.parentFrameId).not.toBeNull();
      const parent = documents.get(document.parentFrameId!);
      expect(parent).toBeDefined();
      expect(document.ownerPath).not.toBeNull();
      expect(parent!.nodes.some((node) => node.path === document.ownerPath && node.name === 'iframe')).toBe(true);
    }
  });

  test('deep documents obey explicit node and depth budgets without recursion failure', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/deep-tree?seed=3');

    const depthLimited = (await adapter.capture(page, { maxDepth: 64, maxNodesPerFrame: 1_000 })).documents[0]!;
    expect(depthLimited.truncated.depth).toBe(true);
    expect(Math.max(...depthLimited.nodes.map((node) => node.depth))).toBe(64);

    const nodeLimited = (await adapter.capture(page, { maxDepth: 1_000, maxNodesPerFrame: 40 })).documents[0]!;
    expect(nodeLimited.truncated.nodes).toBe(true);
    expect(nodeLimited.nodes).toHaveLength(40);

    const focus = (await adapter.capture(page, { mode: 'focus', maxDepth: 1_000, maxNodesPerFrame: 500 })).documents[0]!;
    const active = focus.nodes.find((node) => node.id === focus.activeNode);
    expect(active?.attributes).toContainEqual(['id', 'deep-leaf']);
  });

  test('Unicode, SVG, MathML, and template contents survive capture and TQ1 round trip', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/dom-extremes?seed=29');
    const snapshot = await adapter.capture(page);
    const document = snapshot.documents[0]!;
    expect(document.nodes.some((node) => node.namespace === 'http://www.w3.org/2000/svg' && node.name === 'circle')).toBe(true);
    expect(document.nodes.some((node) => node.namespace === 'http://www.w3.org/1998/Math/MathML' && node.name === 'math')).toBe(true);
    expect(document.nodes.some((node) => node.value?.includes('👩🏽‍🚀'))).toBe(true);
    expect(document.nodes.some((node) => node.kind === 'document-fragment' && node.path.endsWith('/t'))).toBe(true);
    expect(document.nodes.some((node) => node.name === 'button' && node.path.includes('/t/'))).toBe(true);
    expect(decodeTq1(encodeTq1(snapshot))).toEqual(snapshot);
  });

  test('the mutation clock creates replayable state transitions', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/mutation-clock?seed=23');
    const before = await adapter.capture(page);
    await page.evaluate(() => (window as typeof window & { __GYM__: { tick(count: number): number } }).__GYM__.tick(3));
    const after = await adapter.capture(page);
    expect(hash(after)).not.toBe(hash(before));
    expect(after.documents[0]!.nodes.filter((node) => node.attributes.some(([key]) => key === 'data-tick'))).toHaveLength(4);
  });

  test('virtualized state transitions expose stable mutation epochs', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/virtualized-list?seed=8');
    const before = await adapter.capture(page);
    await page.evaluate(() => (window as typeof window & { __GYM__: { tick(count: number): number } }).__GYM__.tick(1));
    const after = await adapter.capture(page);
    const rows = after.documents[0]!.nodes.flatMap((node) => node.attributes.filter(([key]) => key === 'data-row').map(([, value]) => value));

    expect(hash(after.documents)).not.toBe(hash(before.documents));
    expect(rows).toEqual(Array.from({ length: 10 }, (_, index) => String(index + 10)));
    expect(after.documents[0]!.consistency.status).toBe('stable');
    expect(after.documents[0]!.consistency.epochStart).toBeGreaterThan(0);
    expect(after.documents[0]!.consistency.epochStart).toBe(after.documents[0]!.consistency.epochEnd);
  });

  test('layout, nested scrolling, and pointer state are observable', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/geometry-and-scroll?seed=31');
    const geometry = await adapter.capture(page);
    const target = geometry.documents[0]!.nodes.find((node) => node.attributes.some(([key, value]) => key === 'id' && value === 'target'));
    expect(target?.rect?.width).toBe(120);

    await page.goto('/scenario/pointer-state?seed=31');
    const button = page.locator('#pointer-target');
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 20, box!.y + 20);
    const pointer = (await adapter.capture(page)).pointer;
    // DOM pointer coordinates are integer CSS pixels in Firefox/WebKit while
    // Playwright bounding boxes can be fractional.
    expect(Math.abs(pointer!.x - (box!.x + 20))).toBeLessThanOrEqual(1);
    expect(Math.abs(pointer!.y - (box!.y + 20))).toBeLessThanOrEqual(1);
  });

  test('TQ1 encoding is lossless and compressed', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/document-kitchen-sink?seed=99');
    const snapshot = await adapter.capture(page);
    const encoded = encodeTq1(snapshot);
    expect(decodeTq1(encoded)).toEqual(snapshot);
    expect(encoded.byteLength).toBeLessThan(Buffer.byteLength(JSON.stringify(snapshot)));
  });

  test('TQ1 rejects corrupted transport data', () => {
    expect(() => decodeTq1(Buffer.from('not-a-tq1-payload'))).toThrow();
  });
});
