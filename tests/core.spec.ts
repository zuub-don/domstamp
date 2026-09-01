import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  createDomstamp,
  DomstampError,
  inspectSnapshotCompatibility,
  migrateSnapshot,
  runAdapterConformance,
  SNAPSHOT_SCHEMA_VERSION,
  type AdapterCapability,
  type DomSnapshot,
  type DomstampAdapter,
  type DomstampEvidenceProvider,
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
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
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
    }],
    accessibility: [],
    attachments: [],
    evidence: []
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
  test('schema v1 and v2 fixtures migrate explicitly to the current stable shape', () => {
    const legacy = JSON.parse(readFileSync(
      new URL('./fixtures/schema/v1-minimal.json', import.meta.url),
      'utf8'
    )) as unknown;

    expect(inspectSnapshotCompatibility(legacy)).toEqual({
      format: 'domstamp',
      schemaVersion: 1,
      currentVersion: SNAPSHOT_SCHEMA_VERSION,
      readable: true,
      migrationRequired: true
    });
    expect(migrateSnapshot(legacy)).toEqual({
      ...(legacy as Record<string, unknown>),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      accessibility: [],
      attachments: [],
      evidence: []
    });
    const previous = JSON.parse(readFileSync(
      new URL('./fixtures/schema/v2-minimal.json', import.meta.url),
      'utf8'
    )) as unknown;
    expect(inspectSnapshotCompatibility(previous)).toMatchObject({
      schemaVersion: 2,
      readable: true,
      migrationRequired: true
    });
    expect(migrateSnapshot(previous)).toEqual({
      ...(previous as Record<string, unknown>),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      evidence: []
    });
    expect(() => migrateSnapshot({ ...(legacy as Record<string, unknown>), schemaVersion: 99 })).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_SCHEMA' })
    );
    expect(() => migrateSnapshot({ format: 'domstamp', schemaVersion: SNAPSHOT_SCHEMA_VERSION }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_SNAPSHOT' }));
  });

  test('first-party redaction removes secrets without requiring adapter support or breaking graphs', async () => {
    const secret = 'sentinel-secret-314159';
    const captured: DomSnapshot = {
      ...snapshot(),
      documents: [{
        ...snapshot().documents[0]!,
        url: `https://example.test/?token=${secret}`,
        origin: 'https://example.test',
        title: `Account ${secret}`,
        nodes: [{
          ...snapshot().documents[0]!.nodes[0]!,
          attributes: [['id', 'secret-source'], ['data-token', secret]],
          references: [{ kind: 'aria-describedby', value: 'secret-source', target: 0 }],
          state: { value: secret, note: `prefix-${secret}-suffix` },
          style: { '--secret': secret }
        }, {
          id: 1,
          parent: 0,
          depth: 1,
          path: '0/0',
          kind: 'text',
          name: '#text',
          namespace: null,
          value: secret,
          attributes: [],
          references: [],
          state: {},
          rect: null,
          style: {}
        }]
      }],
      accessibility: [{
        frameId: 'frame-0',
        root: 'ax-0',
        source: 'native',
        truncated: false,
        nodes: [{
          id: 'ax-0',
          parent: null,
          role: 'textbox',
          name: `Name ${secret}`,
          description: secret,
          value: secret,
          states: { autocomplete: secret },
          domPath: '0'
        }]
      }],
      evidence: [{
        id: 'fixture-sensitive',
        kind: 'fixture-state',
        frameId: 'frame-0',
        provider: 'fixture',
        providerVersion: '1.0.0',
        source: 'fixture',
        completeness: 'complete',
        privilege: 'standard',
        sensitivity: 'sensitive',
        details: { note: `evidence-${secret}` }
      }]
    };
    const client = createDomstamp(fakeAdapter(async () => captured), {
      defaults: {
        data: {
          mode: 'redact',
          text: [secret],
          attributes: ['data-token'],
          replacement: '[MASKED]'
        }
      }
    });

    const result = await client.captureDetailed('target');
    expect(JSON.stringify(result.snapshot)).not.toContain(secret);
    expect(result.snapshot.documents[0]!.nodes[0]!.references[0]).toEqual({
      kind: 'aria-describedby', value: 'secret-source', target: 0
    });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      level: 'info', code: 'REDACTION_APPLIED'
    }));
  });

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

  test('evidence providers add validated provenance after adapter capture', async () => {
    const provider: DomstampEvidenceProvider<string> = {
      name: 'fixture-evidence',
      version: '1.2.3',
      collect: ({ target, snapshot: captured }) => [{
        id: 'fixture:frame-0',
        kind: 'fixture-state',
        frameId: captured.documents[0]!.frameId,
        source: 'test-provider',
        completeness: 'complete',
        privilege: 'standard',
        sensitivity: 'normal',
        details: { target, nodes: captured.documents[0]!.nodes.length }
      }]
    };
    const result = await createDomstamp(fakeAdapter(), { evidenceProviders: [provider] })
      .captureDetailed('framework-target');

    expect(result.snapshot.evidence).toEqual([{
      id: 'fixture:frame-0',
      kind: 'fixture-state',
      frameId: 'frame-0',
      provider: 'fixture-evidence',
      providerVersion: '1.2.3',
      source: 'test-provider',
      completeness: 'complete',
      privilege: 'standard',
      sensitivity: 'normal',
      details: { target: 'framework-target', nodes: 1 }
    }]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'EVIDENCE_COLLECTED' }));
  });

  test('evidence provider failures retain a stable public error code', async () => {
    const broken: DomstampEvidenceProvider<string> = {
      name: 'broken-evidence',
      version: '1.0.0',
      collect: () => { throw new Error('collector failed'); }
    };
    await expect(createDomstamp(fakeAdapter(), { evidenceProviders: [broken] }).capture('target'))
      .rejects.toMatchObject({ code: 'EVIDENCE_PROVIDER_FAILED' });
  });

  test('the public adapter conformance kit is driver-neutral and deterministic', async () => {
    let disposed = false;
    const report = await runAdapterConformance(fakeAdapter(), {
      createTarget: () => 'framework-owned-target',
      disposeTarget: () => { disposed = true; }
    });
    expect(report).toMatchObject({
      adapter: { name: 'fake', version: '1.0.0' },
      deterministic: true,
      documentCount: 1,
      nodeCount: 1
    });
    expect(report.capabilities).toContain('dom');
    expect(disposed).toBe(true);
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
