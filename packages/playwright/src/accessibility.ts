import type { AccessibilityNode, AccessibilityTree } from 'domstamp';
import type { Frame } from 'playwright-core';
import { parse } from 'yaml';

interface FrameEntry {
  readonly frame: Frame;
  readonly frameId: string;
}

function stateValue(value: string | undefined): boolean | number | string {
  if (value === undefined) return true;
  const unquoted = value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/\\"/g, '"')
    : value;
  if (unquoted === 'true') return true;
  if (unquoted === 'false') return false;
  const numeric = Number(unquoted);
  return unquoted !== '' && Number.isFinite(numeric) ? numeric : unquoted;
}

function descriptor(value: string): {
  role: string;
  name: string;
  states: Record<string, boolean | number | string | null>;
} {
  const bracket = value.match(/\s+\[([^\]]+)\]\s*$/);
  const withoutStates = bracket ? value.slice(0, bracket.index).trim() : value.trim();
  const named = withoutStates.match(/^([^\s"]+)(?:\s+"((?:\\"|[^"])*)")?$/);
  const states: Record<string, boolean | number | string | null> = {};
  if (bracket) {
    const tokenPattern = /([A-Za-z][\w-]*)(?:=("(?:\\"|[^"])*"|[^\s,]+))?/g;
    let token: RegExpExecArray | null;
    while ((token = tokenPattern.exec(bracket[1]!)) !== null) states[token[1]!] = stateValue(token[2]);
  }
  return {
    role: named?.[1] ?? 'unknown',
    name: (named?.[2] ?? '').replace(/\\"/g, '"'),
    states
  };
}

export function parseAriaSnapshot(
  yaml: string,
  frameId: string,
  maxNodes = 100_000
): AccessibilityTree {
  if (yaml.length > maxNodes * 4_096) {
    throw new Error(`ARIA snapshot exceeds the ${maxNodes}-node parse budget`);
  }
  const parsed: unknown = parse(yaml);
  const nodes: AccessibilityNode[] = [];
  let truncated = false;

  const add = (
    role: string,
    name: string,
    value: string | null,
    states: Readonly<Record<string, boolean | number | string | null>>,
    parent: string | null
  ): string | null => {
    if (nodes.length >= maxNodes) {
      truncated = true;
      return null;
    }
    const id = `${frameId}-ax-${nodes.length}`;
    nodes.push({ id, parent, role, name, description: null, value, states, domPath: null });
    return id;
  };

  type Task =
    | { readonly kind: 'value'; readonly value: unknown; readonly parent: string | null }
    | { readonly kind: 'entry'; readonly key: string; readonly child: unknown; readonly parent: string | null };
  const pending: Task[] = [{ kind: 'value', value: parsed, parent: null }];
  while (pending.length > 0) {
    if (nodes.length >= maxNodes) {
      truncated = true;
      break;
    }
    const task = pending.pop()!;
    if (task.kind === 'entry') {
      const { key, child, parent } = task;
      if (key === 'text') {
        const text = child === null || child === undefined ? '' : String(child);
        add('text', text, null, {}, parent);
        continue;
      }
      const parsedDescriptor = descriptor(key);
      const scalar = typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean';
      const id = add(
        parsedDescriptor.role,
        parsedDescriptor.name,
        scalar ? String(child) : null,
        parsedDescriptor.states,
        parent
      );
      if (id !== null && !scalar) pending.push({ kind: 'value', value: child, parent: id });
      continue;
    }
    const { value, parent } = task;
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ kind: 'value', value: value[index], parent });
      }
      continue;
    }
    if (typeof value === 'string') {
      // Playwright emits leaf accessibility nodes (for example
      // `- button "Submit"`) as YAML scalars rather than mappings. Text nodes
      // use the explicit `text:` mapping handled below.
      const leaf = descriptor(value);
      add(leaf.role, leaf.name, null, leaf.states, parent);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      add('text', String(value), null, {}, parent);
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    const entries = Object.entries(value as Record<string, unknown>);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      pending.push({ kind: 'entry', key: entry[0], child: entry[1], parent });
    }
  }

  return {
    frameId,
    root: nodes[0]?.id ?? null,
    source: 'aria-snapshot',
    truncated,
    nodes
  };
}

export async function captureAccessibilityTrees(
  frames: readonly FrameEntry[],
  maxNodesPerFrame: number,
  signal?: AbortSignal
): Promise<AccessibilityTree[]> {
  return await Promise.all(frames.map(async ({ frame, frameId }) => {
    const yaml = await frame.locator('html').ariaSnapshot({
      ...(signal === undefined ? {} : { signal })
    });
    return parseAriaSnapshot(yaml, frameId, maxNodesPerFrame);
  }));
}
