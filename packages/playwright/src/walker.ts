import type { CaptureMode, DocumentSnapshot, DomSnapshot, SnapshotNode } from 'domstamp';
import type { Frame, Page } from 'playwright-core';
import { captureAccessibilityTrees } from './accessibility.js';
import { captureScreenshotAttachment, type PixelCaptureOptions } from './pixels.js';

type MutableSnapshotNode = { -readonly [Key in keyof SnapshotNode]: SnapshotNode[Key] };

export interface CaptureOptions {
  root?: string;
  mode?: CaptureMode;
  maxNodesPerFrame?: number;
  maxDepth?: number;
  includeComments?: boolean;
  includeShadowRoots?: boolean;
  includeTemplates?: boolean;
  captureGeometry?: boolean;
  captureStyles?: boolean;
  styleProperties?: readonly string[];
  allStyleProperties?: boolean;
  captureFocus?: boolean;
  captureSelection?: boolean;
  captureFormState?: boolean;
  captureScroll?: boolean;
  capturePointer?: boolean;
  captureReferences?: boolean;
  viewportMargin?: number;
  focusSiblingCount?: number;
  focusIncludeReferences?: boolean;
  frames?: false | { crossOrigin: boolean; maxFrames: number };
  captureAccessibility?: boolean;
  pixels?: Omit<PixelCaptureOptions, 'signal'>;
  signal?: AbortSignal;
}

interface FrameMetadata {
  frameId: string;
  parentFrameId: string | null;
  ownerPath: string | null;
}

function isFrameDetached(frame: Frame): boolean {
  const candidate = frame as Frame & { readonly detached?: boolean; isDetached?: () => boolean };
  return typeof candidate.isDetached === 'function' ? candidate.isDetached() : candidate.detached === true;
}

function pageViewport(page: Page): { width: number; height: number } | null {
  const candidate = page as Page & {
    viewportSize?: () => { width: number; height: number } | null;
    viewport?: () => { width: number; height: number } | null;
  };
  return typeof candidate.viewportSize === 'function'
    ? candidate.viewportSize()
    : typeof candidate.viewport === 'function'
      ? candidate.viewport()
      : null;
}

const DEFAULT_MAX_NODES = 100_000;
const DEFAULT_MAX_DEPTH = 2_048;

async function captureDocument(
  frame: Frame,
  metadata: FrameMetadata,
  options: CaptureOptions
): Promise<DocumentSnapshot> {
  const mode = options.mode ?? 'document';
  try {
    await frame.evaluate(() => {
      const scope = window as typeof window & {
        __DOMSTAMP_MUTATION_STATE_V1__?: { epoch: number; installations: number; observer: MutationObserver };
      };
      if (!scope.__DOMSTAMP_MUTATION_STATE_V1__) {
        const state = { epoch: 0, installations: 1, observer: null as unknown as MutationObserver };
        state.observer = new MutationObserver((records) => { state.epoch += records.length; });
        state.observer.observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        });
        scope.__DOMSTAMP_MUTATION_STATE_V1__ = state;
      }
    });

    const captured = await frame.evaluate(({
      rootSelector, captureMode, maxNodes, maxDepth, frameMetadata, includeComments,
      includeShadowRoots, includeTemplates, captureGeometry, captureStyles, styleProperties, allStyleProperties,
      captureFocus, captureSelection, captureFormState, captureScroll, captureReferences,
      viewportMargin, focusSiblingCount, focusIncludeReferences
    }): DocumentSnapshot => {
      const nodes: MutableSnapshotNode[] = [];
      const ids = new Map<Node, number>();
      const rawReferences = new Map<number, Array<{ kind: string; value: string; node: Node | null }>>();
      const mutationState = (window as typeof window & {
        __DOMSTAMP_MUTATION_STATE_V1__?: { epoch: number };
      }).__DOMSTAMP_MUTATION_STATE_V1__;
      const epochStart = mutationState?.epoch ?? null;
      let depthTruncated = false;
      let nodesTruncated = false;

      const selectedRoot = rootSelector ? document.querySelector(rootSelector) : document.documentElement;
      if (!selectedRoot) throw new Error(`Snapshot root not found: ${rootSelector}`);

      const composedParent = (node: Node): Node | null => {
        if (node.parentNode) return node.parentNode;
        const root = node.getRootNode();
        return root instanceof ShadowRoot ? root.host : null;
      };

      const childrenOf = (node: Node, limit = maxNodes): Node[] => {
        const children: Node[] = [];
        const append = (child: Node): boolean => {
          if (children.length >= limit) {
            nodesTruncated = true;
            return false;
          }
          children.push(child);
          return true;
        };
        if (includeShadowRoots && node instanceof Element && node.shadowRoot && !append(node.shadowRoot)) return children;
        if (includeTemplates && node instanceof HTMLTemplateElement && !append(node.content)) return children;
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (!includeComments && child instanceof Comment) continue;
          if (!append(child)) break;
        }
        return children;
      };

      const deepActiveElement = (): Element | null => {
        let active: Element | null = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active;
      };

      const includeWithAncestors = (included: Set<Node>, node: Node | null): void => {
        let current = node;
        while (current) {
          included.add(current);
          if (current === selectedRoot) break;
          current = composedParent(current);
        }
      };

      const includeSubtree = (included: Set<Node>, root: Node, limit = maxNodes): void => {
        const pending = [root];
        let count = 0;
        while (pending.length && count < limit) {
          const current = pending.pop()!;
          if (included.has(current)) continue;
          included.add(current);
          count += 1;
          const children = childrenOf(current, Math.max(0, limit - count));
          for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
        }
        if (pending.length) nodesTruncated = true;
      };

      const focusSet = (): Set<Node> => {
        const included = new Set<Node>();
        const active = deepActiveElement() ?? selectedRoot;
        includeWithAncestors(included, active);
        includeSubtree(included, active);

        const parent = composedParent(active);
        if (parent) {
          const siblings = childrenOf(parent).filter((node) => node instanceof Element);
          const index = siblings.indexOf(active);
          const nearby = siblings.slice(Math.max(0, index - focusSiblingCount), index)
            .concat(siblings.slice(index + 1, index + 1 + focusSiblingCount));
          for (const sibling of nearby) {
            if (sibling) {
              includeWithAncestors(included, sibling);
              includeSubtree(included, sibling, 128);
            }
          }
        }

        if (focusIncludeReferences && active instanceof Element) {
          const relationAttributes = ['aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details', 'aria-errormessage', 'aria-labelledby', 'aria-owns'];
          for (const attribute of relationAttributes) {
            for (const targetId of (active.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
              const target = document.getElementById(targetId);
              if (target) {
                includeWithAncestors(included, target);
                includeSubtree(included, target, 128);
              }
            }
          }
          if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
            for (const label of active.labels ?? []) includeWithAncestors(included, label);
          }
        }
        return included;
      };

      const viewportSet = (): Set<Node> => {
        const included = new Set<Node>();
        const pending = [selectedRoot as Node];
        while (pending.length) {
          const current = pending.pop()!;
          if (current instanceof Element) {
            const rect = current.getBoundingClientRect();
            const style = getComputedStyle(current);
            const hasArea = rect.width > 0 || rect.height > 0;
            const intersects = hasArea
              && rect.bottom >= -viewportMargin
              && rect.right >= -viewportMargin
              && rect.top <= innerHeight + viewportMargin
              && rect.left <= innerWidth + viewportMargin;
            if (intersects && style.display !== 'none' && style.visibility !== 'hidden') {
              includeWithAncestors(included, current);
              for (const child of current.childNodes) {
                if (child instanceof Text || child instanceof Comment) included.add(child);
              }
            }
          }
          const children = childrenOf(current);
          for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
        }
        return included;
      };

      const included = captureMode === 'focus' ? focusSet() : captureMode === 'viewport' ? viewportSet() : null;

      const pseudoSelectors: Array<{ selector: string; pseudo: '::before' | '::after' }> = [];
      if (captureStyles) {
        const pendingRuleLists: CSSRuleList[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try { pendingRuleLists.push(sheet.cssRules); } catch { /* cross-origin stylesheet */ }
        }
        while (pendingRuleLists.length > 0 && pseudoSelectors.length < maxNodes) {
          const rules = pendingRuleLists.pop()!;
          for (let index = 0; index < rules.length && pseudoSelectors.length < maxNodes; index += 1) {
            const rule = rules[index]!;
            if (rule instanceof CSSStyleRule) {
              for (const selector of rule.selectorText.split(',')) {
                const match = selector.trim().match(/^(.*?)(::before|::after)$/);
                if (match?.[1] && (match[2] === '::before' || match[2] === '::after')) {
                  pseudoSelectors.push({ selector: match[1].trim(), pseudo: match[2] });
                }
              }
            } else if ('cssRules' in rule) {
              try { pendingRuleLists.push((rule as CSSGroupingRule).cssRules); } catch { /* inaccessible rule group */ }
            }
          }
        }
      }

      const runtimeState = (element: Element): MutableSnapshotNode['state'] => {
        const state: Record<string, boolean | number | string | null> = {};
        if (captureFormState && element instanceof HTMLInputElement) {
          state.value = element.value;
          state.checked = element.checked;
          state.indeterminate = element.indeterminate;
          state.selectionStart = element.selectionStart;
          state.selectionEnd = element.selectionEnd;
          state.selectionDirection = element.selectionDirection;
        } else if (captureFormState && (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
          state.value = element.value;
          if (element instanceof HTMLTextAreaElement) {
            state.selectionStart = element.selectionStart;
            state.selectionEnd = element.selectionEnd;
            state.selectionDirection = element.selectionDirection;
          }
        } else if (captureFormState && element instanceof HTMLOptionElement) {
          state.selected = element.selected;
        } else if (captureFormState && element instanceof HTMLDetailsElement) {
          state.open = element.open;
        }
        if (element instanceof HTMLElement) {
          if (captureFormState) state.contentEditable = element.contentEditable;
          if (captureFocus) state.tabIndex = element.tabIndex;
          if (captureScroll) {
            state.scrollLeft = element.scrollLeft;
            state.scrollTop = element.scrollTop;
          }
        }
        if (element instanceof HTMLCanvasElement) {
          state.canvasWidth = element.width;
          state.canvasHeight = element.height;
          state.canvasBitmap = 'pixel-layer-required';
        }
        if (captureStyles && pseudoSelectors.length > 0) {
          for (const { selector, pseudo } of pseudoSelectors) {
            let matches = false;
            try { matches = element.matches(selector); } catch { /* malformed or unsupported selector */ }
            if (!matches) continue;
            const content = getComputedStyle(element, pseudo).content;
            if (content && content !== 'none' && content !== 'normal') state[`${pseudo}.content`] = content;
          }
        }
        return state;
      };

      const relationAttributes = ['aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details', 'aria-errormessage', 'aria-labelledby', 'aria-owns', 'for'];
      const stack: Array<{ node: Node; parent: number | null; depth: number; path: string }> = [
        { node: selectedRoot, parent: null, depth: 0, path: '0' }
      ];

      while (stack.length) {
        if (nodes.length >= maxNodes) {
          nodesTruncated = true;
          break;
        }
        const current = stack.pop()!;
        if (included && !included.has(current.node)) continue;

        const id = nodes.length;
        ids.set(current.node, id);
        let kind = 'node';
        let name = current.node.nodeName.toLowerCase();
        let namespace: string | null = null;
        let value: string | null = current.node.nodeValue;
        let attributes: Array<[string, string]> = [];
        let state: MutableSnapshotNode['state'] = {};
        let rect: MutableSnapshotNode['rect'] = null;
        let style: MutableSnapshotNode['style'] = {};

        if (current.node instanceof Element) {
          kind = 'element';
          name = current.node.localName;
          namespace = current.node.namespaceURI;
          value = null;
          attributes = Array.from(current.node.attributes, ({ name: key, value: attributeValue }) => [key, attributeValue]);
          attributes.sort(([left], [right]) => left.localeCompare(right));
          state = runtimeState(current.node);
          if (captureGeometry) {
            const box = current.node.getBoundingClientRect();
            rect = { x: box.x, y: box.y, width: box.width, height: box.height };
          }
          if (captureStyles) {
            const computed = getComputedStyle(current.node);
            const properties = allStyleProperties ? Array.from(computed) : styleProperties;
            style = Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]));
          }
          const references: Array<{ kind: string; value: string; node: Node | null }> = [];
          if (captureReferences) {
            for (const attribute of relationAttributes) {
              for (const targetId of (current.node.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
                references.push({ kind: attribute, value: targetId, node: document.getElementById(targetId) });
              }
            }
          }
          if (references.length) rawReferences.set(id, references);
        } else if (current.node instanceof Text) {
          kind = 'text';
          name = '#text';
        } else if (current.node instanceof Comment) {
          kind = 'comment';
          name = '#comment';
        } else if (current.node instanceof ShadowRoot) {
          kind = 'shadow-root';
          name = '#shadow-root';
          namespace = null;
          value = current.node.mode;
        } else if (current.node instanceof DocumentFragment) {
          kind = 'document-fragment';
          name = '#document-fragment';
          namespace = null;
          value = null;
        } else if (current.node instanceof DocumentType) {
          kind = 'doctype';
          name = current.node.name;
          namespace = null;
        }

        nodes.push({
          id,
          parent: current.parent,
          depth: current.depth,
          path: current.path,
          kind,
          name,
          namespace,
          value,
          attributes,
          references: [],
          state,
          rect,
          style
        });

        const children = childrenOf(current.node, Math.max(0, maxNodes - nodes.length));
        if (children.length && current.depth >= maxDepth) {
          depthTruncated = true;
          continue;
        }
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index]!;
          const lightIndex = Array.prototype.indexOf.call(current.node.childNodes, child) as number;
          const segment = child instanceof ShadowRoot ? 's' : child instanceof DocumentFragment ? 't' : String(lightIndex);
          stack.push({ node: child, parent: id, depth: current.depth + 1, path: `${current.path}/${segment}` });
        }
      }

      for (const [sourceId, references] of rawReferences) {
        const source = nodes[sourceId];
        if (!source) continue;
        source.references = references.map((reference) => ({
          kind: reference.kind,
          value: reference.value,
          target: reference.node ? (ids.get(reference.node) ?? null) : null
        }));
      }

      const selection = document.getSelection();
      const selectionDirection = selection && selection.anchorNode && selection.focusNode
        ? selection.anchorNode === selection.focusNode && selection.anchorOffset > selection.focusOffset
          ? 'backward'
          : 'forward'
        : 'none';
      const epochEnd = mutationState?.epoch ?? null;

      return {
        ...frameMetadata,
        url: location.href,
        origin: location.origin,
        title: document.title,
        frameName: window.name,
        mode: captureMode,
        activeNode: captureFocus ? (ids.get(deepActiveElement() as Node) ?? null) : null,
        selection: captureSelection && selection
          ? {
              anchorNode: selection.anchorNode ? (ids.get(selection.anchorNode) ?? null) : null,
              anchorOffset: selection.anchorOffset,
              focusNode: selection.focusNode ? (ids.get(selection.focusNode) ?? null) : null,
              focusOffset: selection.focusOffset,
              direction: selectionDirection
            }
          : null,
        scroll: captureScroll ? { x: scrollX, y: scrollY } : { x: 0, y: 0 },
        consistency: {
          status: epochStart === epochEnd ? 'stable' : 'unstable',
          epochStart,
          epochEnd
        },
        truncated: { nodes: nodesTruncated, depth: depthTruncated },
        nodes
      };
    }, {
      rootSelector: options.root ?? null,
      captureMode: mode,
      maxNodes: options.maxNodesPerFrame ?? DEFAULT_MAX_NODES,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      includeComments: options.includeComments ?? true,
      includeShadowRoots: options.includeShadowRoots ?? true,
      includeTemplates: options.includeTemplates ?? true,
      captureGeometry: options.captureGeometry ?? true,
      captureStyles: options.captureStyles ?? true,
      styleProperties: options.styleProperties ?? [
        'display', 'visibility', 'opacity', 'position', 'z-index', 'overflow',
        'pointer-events', 'color', 'background-color', 'font-size', 'font-weight'
      ],
      allStyleProperties: options.allStyleProperties ?? false,
      captureFocus: options.captureFocus ?? true,
      captureSelection: options.captureSelection ?? true,
      captureFormState: options.captureFormState ?? true,
      captureScroll: options.captureScroll ?? true,
      captureReferences: options.captureReferences ?? true,
      viewportMargin: options.viewportMargin ?? 0,
      focusSiblingCount: options.focusSiblingCount ?? 1,
      focusIncludeReferences: options.focusIncludeReferences ?? true,
      frameMetadata: metadata
    });
    const epochEnd = await frame.evaluate(() => (
      window as typeof window & { __DOMSTAMP_MUTATION_STATE_V1__?: { epoch: number } }
    ).__DOMSTAMP_MUTATION_STATE_V1__?.epoch ?? null);
    return {
      ...captured,
      consistency: {
        status: captured.consistency.epochStart === epochEnd ? 'stable' : 'unstable',
        epochStart: captured.consistency.epochStart,
        epochEnd
      }
    };
  } catch (error) {
    return {
      ...metadata,
      url: frame.url(),
      origin: 'unknown',
      title: '',
      frameName: frame.name(),
      mode,
      activeNode: null,
      selection: null,
      scroll: { x: 0, y: 0 },
      consistency: { status: isFrameDetached(frame) ? 'detached' : 'error', epochStart: null, epochEnd: null },
      truncated: { nodes: false, depth: false },
      nodes: [{
        id: 0,
        parent: null,
        depth: 0,
        path: 'error',
        kind: 'capture-error',
        name: 'capture-error',
        namespace: null,
        value: error instanceof Error ? error.message : String(error),
        attributes: [],
        references: [],
        state: {},
        rect: null,
        style: {}
      }]
    };
  }
}

async function frameElementPath(frame: Frame): Promise<string | null> {
  if (!frame.parentFrame()) return null;
  try {
    const handle = await frame.frameElement();
    const path = await handle.evaluate((element) => {
      const owner = element.ownerDocument;
      if (!owner) return null;
      const root = owner.documentElement;
      const segments: number[] = [];
      let current: Node = element;
      while (current !== root && current.parentNode) {
        segments.unshift(Array.prototype.indexOf.call(current.parentNode.childNodes, current) as number);
        current = current.parentNode;
      }
      return ['0', ...segments.map(String)].join('/');
    });
    await handle.dispose();
    return path;
  } catch {
    return null;
  }
}

export async function capturePlaywrightSnapshot(page: Page, options: CaptureOptions = {}): Promise<DomSnapshot> {
  const frames: Array<{ frame: Frame; metadata: FrameMetadata }> = [];
  const frameOptions = options.frames ?? { crossOrigin: true, maxFrames: 128 };
  const mainOrigin = (() => {
    try { return new URL(page.mainFrame().url()).origin; } catch { return null; }
  })();
  let framesTruncated = false;
  const collect = async (frame: Frame, parentFrameId: string | null): Promise<void> => {
    if (frames.length >= (frameOptions === false ? 1 : frameOptions.maxFrames)) {
      framesTruncated = true;
      return;
    }
    const frameId = `frame-${frames.length}`;
    const metadata = { frameId, parentFrameId, ownerPath: await frameElementPath(frame) };
    frames.push({ frame, metadata });
    if (frameOptions === false) return;
    for (const child of frame.childFrames()) {
      if (!frameOptions.crossOrigin && mainOrigin !== null) {
        try {
          if (new URL(child.url()).origin !== mainOrigin) continue;
        } catch {
          continue;
        }
      }
      await collect(child, frameId);
    }
  };
  await collect(page.mainFrame(), null);

  const documents = await Promise.all(frames.map(({ frame, metadata }) => captureDocument(frame, metadata, options)));
  const pointer = options.capturePointer === false ? null : await page.evaluate(() => {
    const gym = (window as typeof window & {
      __GYM__?: { pointer?: { x: number; y: number; type: string; buttons: number } };
    }).__GYM__;
    return gym?.pointer ?? null;
  });
  const accessibility = options.captureAccessibility
    ? await captureAccessibilityTrees(
        frames.map(({ frame, metadata }) => ({ frame, frameId: metadata.frameId })),
        options.maxNodesPerFrame ?? DEFAULT_MAX_NODES,
        options.signal
      )
    : [];
  const attachments = options.pixels
    ? [await captureScreenshotAttachment(
        page,
        frames.map(({ frame }) => frame),
        { ...options.pixels, ...(options.signal === undefined ? {} : { signal: options.signal }) }
      )]
    : [];

  return {
    format: 'domstamp',
    schemaVersion: 2,
    viewport: pageViewport(page),
    pointer,
    framesTruncated,
    documents,
    accessibility,
    attachments
  };
}
