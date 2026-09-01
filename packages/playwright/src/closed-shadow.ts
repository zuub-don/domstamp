import { randomUUID } from 'node:crypto';
import type { BrowserContext } from 'playwright-core';

export interface ClosedShadowInstrumentation {
  /** Opaque registry accessor consumed by the Domstamp walker. */
  readonly registryKey: string;
  /** Removes the preload from future documents; already-loaded documents remain instrumented. */
  dispose(): Promise<void>;
}

/**
 * Installs before-page instrumentation for author-created closed shadow roots.
 * Call this before creating or navigating pages in the context.
 */
export async function installClosedShadowInstrumentation(
  context: BrowserContext
): Promise<ClosedShadowInstrumentation> {
  const registryKey = `__domstamp_closed_shadow_${randomUUID().replaceAll('-', '')}`;
  const disposable = await context.addInitScript((registryKey) => {
    const scope = window as typeof window & Record<string, unknown>;
    if (typeof scope[registryKey] === 'function') return;

    const roots = new WeakMap<Element, ShadowRoot>();
    const original = Element.prototype.attachShadow;
    const instrumented = function (this: Element, init: ShadowRootInit): ShadowRoot {
      const root = Reflect.apply(original, this, [init]) as ShadowRoot;
      if (init.mode === 'closed') roots.set(this, root);
      return root;
    };
    Object.defineProperty(instrumented, 'name', { value: original.name });
    Object.defineProperty(instrumented, 'length', { value: original.length });
    Object.defineProperty(Element.prototype, 'attachShadow', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: instrumented
    });
    Object.defineProperty(scope, registryKey, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: (host: Element): ShadowRoot | null => roots.get(host) ?? null
    });
  }, registryKey);

  return Object.freeze({
    registryKey,
    dispose: async () => disposable.dispose()
  });
}
