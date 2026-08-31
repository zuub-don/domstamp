import { createHash } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { CaptureMode, DomSnapshot } from 'domstamp';
import { loadAdapter, type SnapshotAdapter } from './support/adapter.js';
import { applyChaosAction, generateChaosPlan, shrinkChaosPlan, type ChaosAction, type ChaosPlan } from './support/chaos.js';

const semanticHash = (snapshot: DomSnapshot): string => {
  const canonical = {
    format: snapshot.format,
    schemaVersion: snapshot.schemaVersion,
    viewport: snapshot.viewport,
    documents: snapshot.documents.map(({ consistency, ...document }) => ({
      ...document,
      consistency: { status: consistency.status }
    }))
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
};

function assertClosedSnapshot(snapshot: DomSnapshot): void {
  const frameIds = new Set(snapshot.documents.map((document) => document.frameId));
  for (const document of snapshot.documents) {
    expect(document.consistency.status).toBe('stable');
    if (document.parentFrameId !== null) expect(frameIds.has(document.parentFrameId)).toBe(true);
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    expect(nodeIds.size).toBe(document.nodes.length);
    for (const node of document.nodes) {
      if (node.parent !== null) expect(nodeIds.has(node.parent)).toBe(true);
      for (const reference of node.references) {
        if (reference.target !== null) expect(nodeIds.has(reference.target)).toBe(true);
      }
    }
  }
}

async function runCampaign(
  page: Page,
  adapter: SnapshotAdapter,
  plan: ChaosPlan,
  checkpointEvery: number
): Promise<Array<{ step: number; mode: CaptureMode; hash: string }>> {
  await page.goto(`/scenario/chaos-laboratory?seed=${plan.seed}`);
  await expect.poll(() => page.frames().length).toBe(2);
  const checkpoints: Array<{ step: number; mode: CaptureMode; hash: string }> = [];
  const modes: CaptureMode[] = ['document', 'focus', 'viewport'];

  for (const action of plan.actions) {
    await applyChaosAction(page, action);
    if ((action.step + 1) % checkpointEvery !== 0 && action.step !== plan.actions.length - 1) continue;
    const mode = modes[checkpoints.length % modes.length]!;
    const snapshot = await adapter.capture(page, { mode, maxNodesPerFrame: 5_000, maxDepth: 512 });
    assertClosedSnapshot(snapshot);
    checkpoints.push({ step: action.step, mode, hash: semanticHash(snapshot) });
  }
  return checkpoints;
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json'
  });
}

test.describe('@conformance @chaos deterministic chaos engineering', () => {
  test('plans are reproducible and failing histories can be minimized', async () => {
    const first = generateChaosPlan(0x5eedc0de, 64);
    const second = generateChaosPlan(0x5eedc0de, 64);
    const different = generateChaosPlan(0x5eedc0df, 64);
    expect(second).toEqual(first);
    expect(different).not.toEqual(first);

    const synthetic: ChaosAction[] = [
      { step: 0, kind: 'focus', target: 0, value: 'a' },
      { step: 1, kind: 'frame-toggle', target: 0, value: 'b' },
      { step: 2, kind: 'edit', target: 0, value: 'c' },
      { step: 3, kind: 'network', target: 0, value: 'disconnect' },
      { step: 4, kind: 'scroll', target: 4, value: 'd' }
    ];
    const minimized = await shrinkChaosPlan(synthetic, async (candidate) =>
      candidate.some(({ kind }) => kind === 'frame-toggle') && candidate.some(({ kind }) => kind === 'network')
    );
    expect(minimized.map(({ kind }) => kind).sort()).toEqual(['frame-toggle', 'network']);
  });

  test('a seeded mixed-fault campaign replays to identical checkpoints', async ({ page }, testInfo) => {
    // The normal path completes quickly; failures receive enough time for
    // repeated delta-debugging replays to emit a genuinely minimized history.
    test.setTimeout(300_000);
    const adapter = await loadAdapter();
    const seed = Number(process.env.CHAOS_SEED ?? 0xdecafbad);
    const steps = Number(process.env.CHAOS_STEPS ?? 43);
    const generated = generateChaosPlan(seed, steps);
    const requiredNetworkFaults: ChaosAction[] = ['ok', 'status', 'delay', 'disconnect', 'truncate'].map((value, index) => ({
      step: index,
      kind: 'network',
      target: 900 + index,
      value
    }));
    const actions = requiredNetworkFaults
      .concat(generated.actions)
      .map((action, step) => ({ ...action, step }));
    const plan: ChaosPlan = { version: 1, seed: generated.seed, actions };
    await attachJson(testInfo, 'chaos-plan.json', plan);
    await testInfo.attach('chaos-replay.txt', {
      body: Buffer.from(`CHAOS_SEED=${seed} CHAOS_STEPS=${steps} npm run test:chaos -- --project=${testInfo.project.name}\n`),
      contentType: 'text/plain'
    });

    try {
      const first = await runCampaign(page, adapter, plan, 4);
      const replay = await runCampaign(page, adapter, plan, 4);
      await attachJson(testInfo, 'chaos-checkpoints.json', { first, replay });
      expect(replay).toEqual(first);
    } catch (error) {
      const minimized = await shrinkChaosPlan(plan.actions, async (candidate) => {
        const reindexed = candidate.map((action, step) => ({ ...action, step }));
        try {
          await runCampaign(page, adapter, { ...plan, actions: reindexed }, 4);
          return false;
        } catch {
          return true;
        }
      });
      await attachJson(testInfo, 'chaos-minimized.json', {
        ...plan,
        actions: minimized.map((action, step) => ({ ...action, step }))
      });
      throw error;
    }
  });
});
