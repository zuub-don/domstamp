import type { Page } from '@playwright/test';

export type ChaosKind =
  | 'focus'
  | 'edit'
  | 'visibility'
  | 'reorder'
  | 'replace'
  | 'scroll'
  | 'frame-toggle'
  | 'frame-navigate'
  | 'slot'
  | 'tick'
  | 'network';

export interface ChaosAction {
  step: number;
  kind: ChaosKind;
  target: number;
  value: string;
}

export interface ChaosPlan {
  version: 1;
  seed: number;
  actions: ChaosAction[];
}

const kinds: ChaosKind[] = [
  'focus', 'focus', 'edit', 'visibility', 'reorder', 'replace', 'scroll',
  'frame-toggle', 'frame-navigate', 'slot', 'tick', 'tick', 'network'
];
const networkFaults = ['ok', 'status', 'delay', 'disconnect', 'truncate'];

function xorshift32(initialSeed: number): () => number {
  let state = initialSeed | 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

export function generateChaosPlan(seed: number, steps: number): ChaosPlan {
  const random = xorshift32(seed);
  const actions = Array.from({ length: steps }, (_, step): ChaosAction => {
    const kind = kinds[random() % kinds.length]!;
    const target = random() % 10_000;
    const token = random().toString(36);
    const value = kind === 'network'
      ? networkFaults[random() % networkFaults.length]!
      : `chaos-${seed}-${step}-${token}`;
    return { step, kind, target, value };
  });
  return { version: 1, seed, actions };
}

export async function applyChaosAction(page: Page, action: ChaosAction): Promise<void> {
  const result = await page.evaluate(async (nextAction) => {
    const gym = (window as typeof window & {
      __GYM__: { chaos(action: ChaosAction): Promise<{ frames: number; ticks: number }> };
    }).__GYM__;
    return gym.chaos(nextAction);
  }, action);

  await page.waitForFunction(
    (expectedFrames) => document.querySelectorAll('iframe').length === expectedFrames,
    result.frames
  );
  if (action.kind === 'frame-toggle' || action.kind === 'frame-navigate') {
    await Promise.all(page.frames().map(async (frame) => {
      await frame.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
    }));
  }
}

export async function shrinkChaosPlan(
  actions: readonly ChaosAction[],
  reproduces: (candidate: readonly ChaosAction[]) => Promise<boolean>
): Promise<ChaosAction[]> {
  let candidate = [...actions];
  let partitions = 2;

  while (candidate.length >= 2) {
    const chunkSize = Math.ceil(candidate.length / partitions);
    let reduced = false;
    for (let start = 0; start < candidate.length; start += chunkSize) {
      const attempt = candidate.slice(0, start).concat(candidate.slice(start + chunkSize));
      if (attempt.length > 0 && await reproduces(attempt)) {
        candidate = attempt;
        partitions = Math.max(2, partitions - 1);
        reduced = true;
        break;
      }
    }
    if (reduced) continue;
    if (partitions >= candidate.length) break;
    partitions = Math.min(candidate.length, partitions * 2);
  }

  return candidate;
}
