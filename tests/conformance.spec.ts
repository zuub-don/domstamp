import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDomstamp } from 'domstamp';
import { installClosedShadowInstrumentation, playwrightAdapter } from '@domstamp/playwright';
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

  test('optional accessibility trees expose roles, names, values, and closed parent graphs', async ({ page }) => {
    await page.goto('/scenario/focus-and-forms?seed=91');
    const client = createDomstamp(playwrightAdapter(), {
      defaults: { features: { accessibility: { relationships: true, tree: true } } }
    });
    const snapshot = await client.capture(page);

    expect(snapshot.accessibility).toHaveLength(1);
    const tree = snapshot.accessibility[0]!;
    expect(tree.source).toBe('aria-snapshot');
    expect(tree.nodes.some((node) => node.role === 'textbox' && node.name === 'Name')).toBe(true);
    expect(tree.nodes.some((node) => node.role === 'button' && node.name === 'Submit')).toBe(true);
    const ids = new Set(tree.nodes.map((node) => node.id));
    for (const node of tree.nodes) {
      if (node.parent !== null) expect(ids.has(node.parent)).toBe(true);
    }
  });

  test('pixel attachments are hashed, dimensioned, masked, and structurally redacted', async ({ page }) => {
    const initialSecret = 'sentinel-73';
    const changedSecret = 'changed-secret-73';
    await page.goto('/scenario/sensitive-data?seed=73');
    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        features: {
          accessibility: { relationships: true, tree: true },
          pixels: { format: 'png', fullPage: false, scale: 'css' }
        },
        data: {
          mode: 'redact',
          text: [initialSecret, changedSecret],
          attributes: ['data-token'],
          pixelMasks: ['.secret-zone'],
          replacement: '[MASKED]'
        }
      }
    });
    const first = await client.capture(page);
    expect(JSON.stringify(first)).not.toContain(initialSecret);
    expect(first.attachments).toHaveLength(1);
    expect(first.attachments[0]).toMatchObject({
      kind: 'screenshot',
      mediaType: 'image/png',
      width: 1280,
      height: 720
    });
    expect(first.attachments[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);

    await page.locator('.secret-zone').evaluate((element, secret) => {
      element.querySelector('label')!.textContent = `Credential ${secret}`;
      element.querySelector('input')!.setAttribute('value', secret);
      (element.querySelector('input') as HTMLInputElement).value = secret;
      element.querySelector('p')!.textContent = `Visible ${secret}`;
    }, changedSecret);
    const second = await client.capture(page);
    expect(JSON.stringify(second)).not.toContain(changedSecret);
    expect(second.attachments[0]!.sha256).toBe(first.attachments[0]!.sha256);
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

  test('generated content and canvas boundaries are explicit while pixels preserve rendered output', async ({ page }) => {
    await page.goto('/scenario/rendering-boundaries?seed=37');
    const client = createDomstamp(playwrightAdapter(), {
      defaults: { features: { pixels: { format: 'png', fullPage: false, scale: 'css' } } }
    });
    const snapshot = await client.capture(page);
    const byId = (id: string) => snapshot.documents[0]!.nodes.find((node) =>
      node.attributes.some(([name, value]) => name === 'id' && value === id));

    expect(byId('generated')?.state).toMatchObject({
      '::before.content': '"before-37"',
      '::after.content': '"after-37"'
    });
    expect(byId('bitmap')?.state).toMatchObject({
      canvasWidth: 180,
      canvasHeight: 72,
      canvasBitmap: 'pixel-layer-required'
    });
    expect(snapshot.attachments[0]?.kind).toBe('screenshot');
    // Closed roots are a declared unsupported capability; the host remains
    // visible but inaccessible internals are never implied to be captured.
    expect(byId('closed-widget')).toBeDefined();
    expect(snapshot.documents[0]!.nodes.some((node) => node.value === 'inaccessible closed control')).toBe(false);
  });

  test('instrumented closed roots are iterative, provenance-labeled, and mutation-aware', async ({ context, page }) => {
    const instrumentation = await installClosedShadowInstrumentation(context);
    try {
      await page.goto('/scenario/rendering-boundaries?seed=38');
      const client = createDomstamp(playwrightAdapter({ closedShadowRoots: instrumentation }), {
        defaults: { features: { dom: { shadowRoots: 'all-available' } } }
      });
      expect(client.adapter.capabilities.has('closed-shadow-roots')).toBe(true);
      const first = await client.capture(page);
      const firstDocument = first.documents[0]!;

      expect(firstDocument.nodes.filter((node) => node.kind === 'shadow-root' && node.value === 'closed')).toHaveLength(2);
      expect(firstDocument.nodes.some((node) => node.value === 'inaccessible closed control')).toBe(true);
      expect(firstDocument.nodes.some((node) => node.value === 'nested closed value 38')).toBe(true);
      expect(first.evidence).toContainEqual(expect.objectContaining({
        id: 'closed-shadow-dom:frame-0',
        completeness: 'instrumented',
        privilege: 'instrumented',
        details: { instrumentationAvailable: true, capturedRoots: 2 }
      }));

      await page.evaluate(() => (window as typeof window & {
        __GYM__: { addClosedRoot(): void };
      }).__GYM__.addClosedRoot());
      const second = await client.capture(page);
      expect(second.documents[0]!.nodes.filter((node) => node.kind === 'shadow-root' && node.value === 'closed')).toHaveLength(3);
      expect(second.documents[0]!.nodes.some((node) => node.state.value === 'dynamic-closed-38')).toBe(true);
      expect(second.evidence[0]?.details.capturedRoots).toBe(3);
    } finally {
      await instrumentation.dispose();
    }
  });

  test('closed-root instrumentation reaches cross-origin frame documents', async ({ context, page }) => {
    const instrumentation = await installClosedShadowInstrumentation(context);
    try {
      await page.goto('/scenario/frames?seed=39');
      await page.locator('#cross-origin').evaluate((frame) => {
        const target = new URL((frame as HTMLIFrameElement).src);
        target.pathname = '/scenario/rendering-boundaries';
        target.search = '?seed=39';
        (frame as HTMLIFrameElement).src = target.href;
      });
      await expect.poll(() => page.frames().some((frame) => frame.url().includes('rendering-boundaries'))).toBe(true);

      const snapshot = await createDomstamp(playwrightAdapter({ closedShadowRoots: instrumentation }), {
        defaults: { features: { dom: { shadowRoots: 'all-available' } } }
      }).capture(page);
      const child = snapshot.documents.find((document) => document.url.includes('rendering-boundaries'));
      expect(child).toBeDefined();
      expect(child!.nodes.filter((node) => node.kind === 'shadow-root' && node.value === 'closed')).toHaveLength(2);
      expect(snapshot.evidence).toContainEqual(expect.objectContaining({
        frameId: child!.frameId,
        completeness: 'instrumented',
        details: { instrumentationAvailable: true, capturedRoots: 2 }
      }));
    } finally {
      await instrumentation.dispose();
    }
  });

  test('@chaos closed-root churn remains bounded, deterministic, and graph-valid', async ({ context, page }) => {
    const instrumentation = await installClosedShadowInstrumentation(context);
    try {
      await page.goto('/scenario/rendering-boundaries?seed=40');
      const client = createDomstamp(playwrightAdapter({ closedShadowRoots: instrumentation }), {
        defaults: {
          features: { dom: { shadowRoots: 'all-available' } },
          limits: { maxNodesPerFrame: 2_000, maxDepth: 256 }
        }
      });
      let dynamicRoots = 0;
      for (let step = 0; step < 18; step += 1) {
        const action = step % 3 === 2 ? 'remove' : 'add';
        dynamicRoots = await page.evaluate((next) => (window as typeof window & {
          __GYM__: { churnClosedRoots(action: string): number };
        }).__GYM__.churnClosedRoots(next), action);
        const snapshot = await client.capture(page);
        const document = snapshot.documents[0]!;
        expect(document.consistency.status).toBe('stable');
        expect(document.truncated).toEqual({ nodes: false, depth: false });
        expect(document.nodes.filter((node) => node.kind === 'shadow-root' && node.value === 'closed'))
          .toHaveLength(2 + dynamicRoots);
        expect(snapshot.evidence[0]?.details.capturedRoots).toBe(2 + dynamicRoots);
      }
      const stable = await client.capture(page);
      expect(await client.capture(page)).toEqual(stable);
      expect(decodeTq1(encodeTq1(stable))).toEqual(stable);
    } finally {
      await instrumentation.dispose();
    }
  });

  test('detached frame churn degrades to explicit frame status without breaking graph closure', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/frame-churn?seed=51');
    await expect.poll(() => page.frames().length).toBe(2);
    await page.evaluate(() => (window as typeof window & {
      __GYM__: { startFrameChurn(): void };
    }).__GYM__.startFrameChurn());
    const snapshot = await adapter.capture(page, { maxNodesPerFrame: 5_000 });
    const frameIds = new Set(snapshot.documents.map((document) => document.frameId));
    for (const document of snapshot.documents) {
      expect(['stable', 'unstable', 'detached', 'error']).toContain(document.consistency.status);
      if (document.parentFrameId !== null) expect(frameIds.has(document.parentFrameId)).toBe(true);
    }
  });

  test('hostile page hooks fail closed as an explicit document error', async ({ page }) => {
    const adapter = await loadAdapter();
    await page.goto('/scenario/hostile-prototypes?seed=61');
    await page.evaluate(() => (window as typeof window & {
      __GYM__: { armHostility(): void };
    }).__GYM__.armHostility());
    const snapshot = await adapter.capture(page);
    expect(snapshot.documents[0]!.consistency.status).toBe('error');
    expect(snapshot.documents[0]!.nodes).toHaveLength(1);
    expect(snapshot.documents[0]!.nodes[0]).toMatchObject({ kind: 'capture-error', name: 'capture-error' });
  });

  test('wide documents obey a hard node budget under scale pressure', async ({ page }) => {
    test.setTimeout(120_000);
    const requested = Number(process.env.DOMSTAMP_SCALE_NODES ?? 25_000);
    await page.goto(`/scenario/scale-wide?seed=71&nodes=${requested}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-node-count', String(Math.min(requested, 1_000_000)));
    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        features: {
          dom: { shadowRoots: 'none' },
          layout: false,
          frames: false,
          interaction: false,
          accessibility: false
        },
        limits: { maxNodesPerFrame: 2_000, maxDepth: 32 }
      }
    });
    const started = performance.now();
    const document = (await client.capture(page)).documents[0]!;
    expect(document.nodes).toHaveLength(2_000);
    expect(document.truncated.nodes).toBe(true);
    expect(performance.now() - started).toBeLessThan(30_000);
  });

  test('repeated captures reuse one mutation observer and remain stable across a long session', async ({ page }) => {
    test.setTimeout(120_000);
    const adapter = await loadAdapter();
    await page.goto('/scenario/document-kitchen-sink?seed=81');
    for (let index = 0; index < 30; index += 1) {
      const snapshot = await adapter.capture(page, { maxNodesPerFrame: 5_000 });
      expect(snapshot.documents[0]!.consistency.status).toBe('stable');
    }
    const mutationState = await page.evaluate(() => (
      window as typeof window & {
        __DOMSTAMP_MUTATION_STATE_V1__?: { epoch: number; installations: number };
      }
    ).__DOMSTAMP_MUTATION_STATE_V1__);
    expect(mutationState).toMatchObject({ installations: 1 });

    for (let navigation = 0; navigation < 6; navigation += 1) {
      await page.goto(`/scenario/document-kitchen-sink?seed=${82 + navigation}`);
      const snapshot = await adapter.capture(page);
      expect(snapshot.documents[0]!.consistency.status).toBe('stable');
    }
  });
});
