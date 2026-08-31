import { expect, test } from '@playwright/test';
import {
  createDomstamp,
  DomstampError,
  type AdapterCapability,
  type DomSnapshot,
  type DomstampAdapter,
  type DomstampPlugin
} from 'domstamp';
import { decodeTq1, encodeTq1, Tq1Error } from '@domstamp/tq1';
import { playwrightAdapter } from '@domstamp/playwright';

const allDefaultCapabilities = new Set<AdapterCapability>([
  'cross-origin-frames',
  'dom',
  'frames',
  'interaction',
  'layout',
  'mutation-consistency',
  'open-shadow-roots'
]);

function snapshot(status: 'stable' | 'unstable' = 'stable'): DomSnapshot {
  return {
    format: 'domstamp',
    schemaVersion: 1,
    viewport: { width: 1280, height: 720 },
    pointer: null,
    framesTruncated: false,
    documents: [{
      frameId: 'frame-0',
      parentFrameId: null,
      ownerPath: null,
      url: 'https://example.test/',
      origin: 'https://example.test',
      title: 'fixture',
      frameName: '',
      mode: 'document',
      activeNode: 0,
      selection: null,
      scroll: { x: 0, y: 0 },
      consistency: { status, epochStart: 1, epochEnd: status === 'stable' ? 1 : 2 },
      truncated: { nodes: false, depth: false },
      nodes: [{
        id: 0,
        parent: null,
        depth: 0,
        path: '0',
        kind: 'element',
        name: 'html',
        namespace: 'http://www.w3.org/1999/xhtml',
        value: null,
        attributes: [],
        references: [],
        state: {},
        rect: null,
        style: {}
      }]
    }]
  };
}

function fakeAdapter(
  capture: DomstampAdapter<string>['capture'] = async () => snapshot()
): DomstampAdapter<string> {
  return {
    name: 'fake',
    version: '1.0.0',
    capabilities: allDefaultCapabilities,
    capture
  };
}

test.describe('@conformance @core public TypeScript contract', () => {
  test('configuration is typed, merged immutably, and passed to a generic adapter', async () => {
    let received: unknown;
    const client = createDomstamp(fakeAdapter(async (_target, context) => {
      received = context.config;
      return snapshot();
    }), {
      defaults: {
        scope: { mode: 'focus', siblingCount: 2 },
        limits: { maxNodesPerFrame: 5_000 }
      }
    });

    await client.capture('framework-agnostic-target', {
      scope: { mode: 'viewport', margin: 24 },
      limits: { maxDepth: 99 }
    });

    expect(received).toMatchObject({
      scope: { mode: 'viewport', margin: 24 },
      limits: { maxNodesPerFrame: 5_000, maxDepth: 99 }
    });
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen((received as { features: object }).features)).toBe(true);
    expect(client.adapter.name).toBe('fake');
  });

  test('unsupported features fail before the adapter is invoked', async () => {
    let invoked = false;
    const adapter = fakeAdapter(async () => {
      invoked = true;
      return snapshot();
    });
    const limited: DomstampAdapter<string> = {
      ...adapter,
      capabilities: new Set<AdapterCapability>(['dom']),
      defaults: {
        features: {
          dom: { shadowRoots: 'none' },
          layout: false,
          frames: false,
          interaction: false,
          accessibility: false,
          pixels: false
        },
        consistency: { mode: 'best-effort' }
      }
    };
    const client = createDomstamp(limited);

    await expect(client.capture('target')).resolves.toMatchObject({ format: 'domstamp' });
    invoked = false;

    await expect(client.capture('target', {
      features: { pixels: { format: 'png' } }
    })).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY' });
    expect(invoked).toBe(false);

    await expect(createDomstamp(fakeAdapter()).capture('target', {
      features: { dom: { shadowRoots: 'all-available' } }
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_CAPABILITY',
      details: { missing: ['closed-shadow-roots'] }
    });
  });

  test('timeouts are enforced even when an adapter ignores cancellation', async () => {
    const client = createDomstamp(fakeAdapter(async () => await new Promise<DomSnapshot>(() => undefined)), {
      defaults: { limits: { timeoutMs: 20 } }
    });
    await expect(client.capture('target')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test('caller cancellation remains distinguishable from a timeout', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createDomstamp(fakeAdapter()).capture('target', { signal: controller.signal }))
      .rejects.toMatchObject({ code: 'ABORTED' });
  });

  test('unstable captures retry and persistent instability is diagnosed', async () => {
    let calls = 0;
    const recovering = createDomstamp(fakeAdapter(async () => {
      calls += 1;
      return snapshot(calls === 1 ? 'unstable' : 'stable');
    }), { defaults: { consistency: { mode: 'verify', retries: 2, settleMs: 0 } } });
    const recovered = await recovering.captureDetailed('target');
    expect(calls).toBe(2);
    expect(recovered.diagnostics).toEqual([]);

    const persistent = createDomstamp(fakeAdapter(async () => snapshot('unstable')), {
      defaults: { consistency: { mode: 'verify', retries: 1, settleMs: 0 } }
    });
    const result = await persistent.captureDetailed('target');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'UNSTABLE_CAPTURE' }));
  });

  test('plugin lifecycle is ordered and plugin failures have a stable error code', async () => {
    const events: string[] = [];
    const plugin: DomstampPlugin<string> = {
      name: 'observer',
      beforeCapture: () => { events.push('before'); },
      transform: (value) => { events.push('transform'); return value; },
      afterCapture: () => { events.push('after'); }
    };
    await createDomstamp(fakeAdapter(async () => {
      events.push('adapter');
      return snapshot();
    }), { plugins: [plugin] }).capture('target');
    expect(events).toEqual(['before', 'adapter', 'transform', 'after']);

    const broken: DomstampPlugin<string> = { name: 'broken', transform: () => { throw new Error('boom'); } };
    await expect(createDomstamp(fakeAdapter(), { plugins: [broken] }).capture('target'))
      .rejects.toMatchObject({ code: 'PLUGIN_FAILED' });
  });

  test('invalid snapshots and configured byte overruns are rejected', async () => {
    const invalid = snapshot() as { format: string };
    invalid.format = 'wrong';
    await expect(createDomstamp(fakeAdapter(async () => invalid as DomSnapshot)).capture('target'))
      .rejects.toBeInstanceOf(DomstampError);

    await expect(createDomstamp(fakeAdapter(), {
      defaults: { limits: { maxSnapshotBytes: 10 } }
    }).capture('target')).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });

    const parentCycle = snapshot() as unknown as { documents: Array<{ nodes: Array<{ parent: number | null }> }> };
    parentCycle.documents[0]!.nodes[0]!.parent = 0;
    await expect(createDomstamp(fakeAdapter(async () => parentCycle as unknown as DomSnapshot)).capture('target'))
      .rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });

    const cyclicState = snapshot() as unknown as { documents: Array<{ nodes: Array<{ state: Record<string, unknown> }> }> };
    cyclicState.documents[0]!.nodes[0]!.state.self = cyclicState;
    await expect(createDomstamp(fakeAdapter(async () => cyclicState as unknown as DomSnapshot)).capture('target'))
      .rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });
  });

  test('TQ1 is lossless and rejects cycles, invalid numbers, bombs, and prototype keys', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"safe":"yes"}') as Record<string, unknown>;
    const decoded = decodeTq1(encodeTq1(hostile)) as Record<string, unknown>;
    expect(decoded).toEqual(hostile);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(() => encodeTq1(Number.NaN)).toThrow(Tq1Error);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => encodeTq1(cyclic)).toThrow(Tq1Error);
    const payload = encodeTq1({ repeated: 'value'.repeat(1_000) });
    expect(() => decodeTq1(payload, { limits: { maxCompressedBytes: 1 } })).toThrow(Tq1Error);
    expect(() => decodeTq1(payload, { limits: { maxDepth: -1 } })).toThrow(Tq1Error);
  });

  test('the Playwright adapter honors feature switches instead of merely accepting them', async ({ page }) => {
    await page.goto('/scenario/frames?seed=88');
    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        features: {
          dom: { comments: false, shadowRoots: 'none', templates: false },
          layout: false,
          frames: false,
          interaction: false,
          accessibility: false,
          pixels: false
        },
        consistency: { mode: 'best-effort' }
      }
    });
    const captured = await client.capture(page);

    expect(captured.documents).toHaveLength(1);
    expect(captured.pointer).toBeNull();
    expect(captured.documents[0]!.nodes.some((node) => node.kind === 'comment')).toBe(false);
    expect(captured.documents[0]!.nodes.every((node) => node.rect === null && Object.keys(node.style).length === 0)).toBe(true);
    expect(captured.documents[0]!.nodes.every((node) => Object.keys(node.state).length === 0)).toBe(true);
  });
});
