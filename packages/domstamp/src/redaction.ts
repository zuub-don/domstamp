import type { DataPolicy } from './config.js';
import type { AccessibilityNode, DomSnapshot, SnapshotEvidence, SnapshotNode } from './schema.js';

const DEFAULT_SENSITIVE_ATTRIBUTES = Object.freeze([
  'authorization',
  'cookie',
  'data-secret',
  'data-token',
  'set-cookie',
  'value'
]);

export interface RedactionResult {
  readonly snapshot: DomSnapshot;
  readonly replacements: number;
}

function replaceLiterals(value: string, needles: readonly string[], replacement: string): [string, number] {
  let output = value;
  let count = 0;
  for (const needle of needles) {
    if (!needle) continue;
    const pieces = output.split(needle);
    if (pieces.length > 1) {
      count += pieces.length - 1;
      output = pieces.join(replacement);
    }
  }
  return [output, count];
}

function redactNode(
  node: SnapshotNode,
  attributeNames: ReadonlySet<string>,
  needles: readonly string[],
  replacement: string,
  inputValues: boolean
): { node: SnapshotNode; replacements: number; redactedIds: ReadonlySet<string> } {
  let replacements = 0;
  const redactedIds = new Set<string>();
  const redactString = (value: string): string => {
    const [redacted, count] = replaceLiterals(value, needles, replacement);
    replacements += count;
    return redacted;
  };
  const attributes = node.attributes.map(([name, value]) => {
    if (attributeNames.has(name.toLowerCase())) {
      if (name.toLowerCase() === 'id') redactedIds.add(value);
      if (value !== replacement) replacements += 1;
      return [name, replacement] as const;
    }
    return [name, redactString(value)] as const;
  });
  const state = Object.fromEntries(Object.entries(node.state).map(([name, value]) => {
    if (typeof value !== 'string') return [name, value];
    if (inputValues && name === 'value') {
      if (value !== replacement) replacements += 1;
      return [name, replacement];
    }
    return [name, redactString(value)];
  }));
  const style = Object.fromEntries(Object.entries(node.style).map(([name, value]) => [name, redactString(value)]));
  return {
    node: {
      ...node,
      value: node.value === null ? null : redactString(node.value),
      attributes,
      references: node.references.map((reference) => ({ ...reference, value: redactString(reference.value) })),
      state,
      style
    },
    replacements,
    redactedIds
  };
}

function redactAccessibilityNode(
  node: AccessibilityNode,
  needles: readonly string[],
  replacement: string,
  inputValues: boolean,
  redactAll: boolean
): { node: AccessibilityNode; replacements: number } {
  let replacements = 0;
  const redactString = (value: string): string => {
    const [redacted, count] = replaceLiterals(value, needles, replacement);
    replacements += count;
    return redacted;
  };
  const sensitiveValueRole = ['combobox', 'searchbox', 'spinbutton', 'textbox'].includes(node.role);
  const redactField = (value: string | null, force: boolean): string | null => {
    if (value === null) return null;
    if (force) {
      if (value !== replacement) replacements += 1;
      return replacement;
    }
    return redactString(value);
  };
  return {
    node: {
      ...node,
      name: redactField(node.name, redactAll) ?? '',
      description: redactField(node.description, redactAll),
      value: redactField(node.value, redactAll || (inputValues && sensitiveValueRole)),
      states: Object.fromEntries(Object.entries(node.states).map(([name, value]) => [
        name,
        typeof value === 'string' ? redactString(value) : value
      ]))
    },
    replacements
  };
}

export function redactSnapshot(snapshot: DomSnapshot, policy: Extract<DataPolicy, { mode: 'redact' }>): RedactionResult {
  const replacement = policy.replacement ?? '[REDACTED]';
  const needles = policy.text ?? [];
  const inputValues = policy.inputValues ?? true;
  const attributeNames = new Set((policy.attributes ?? DEFAULT_SENSITIVE_ATTRIBUTES).map((name) => name.toLowerCase()));
  let replacements = 0;
  const documents = snapshot.documents.map((document) => {
    const redactedIds = new Set<string>();
    const nodes = document.nodes.map((node) => {
      const redacted = redactNode(node, attributeNames, needles, replacement, inputValues);
      replacements += redacted.replacements;
      for (const id of redacted.redactedIds) redactedIds.add(id);
      return redacted.node;
    }).map((node) => ({
      ...node,
      references: node.references.map((reference) => {
        if (!redactedIds.has(reference.value)) return reference;
        if (reference.value !== replacement) replacements += 1;
        return { ...reference, value: replacement };
      })
    }));
    const redactMetadata = (value: string, force: boolean): string => {
      if (force) {
        if (value !== replacement) replacements += 1;
        return replacement;
      }
      const [redacted, count] = replaceLiterals(value, needles, replacement);
      replacements += count;
      return redacted;
    };
    return {
      ...document,
      url: redactMetadata(document.url, policy.urls ?? true),
      origin: redactMetadata(document.origin, policy.urls ?? true),
      title: redactMetadata(document.title, policy.titles ?? true),
      frameName: redactMetadata(document.frameName, false),
      nodes
    };
  });
  const accessibility = snapshot.accessibility.map((tree) => ({
    ...tree,
    nodes: tree.nodes.map((node) => {
      const redacted = redactAccessibilityNode(
        node,
        needles,
        replacement,
        inputValues,
        policy.accessibility ?? false
      );
      replacements += redacted.replacements;
      return redacted.node;
    })
  }));
  const evidence = snapshot.evidence.map((entry): SnapshotEvidence => ({
    ...entry,
    details: Object.fromEntries(Object.entries(entry.details).map(([name, value]) => {
      if (typeof value !== 'string') return [name, value];
      const [redacted, count] = replaceLiterals(value, needles, replacement);
      replacements += count;
      return [name, redacted];
    }))
  }));
  return {
    snapshot: { ...snapshot, documents, accessibility, evidence },
    replacements
  };
}
