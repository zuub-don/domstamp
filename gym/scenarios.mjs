export const scenarioNames = [
  'document-kitchen-sink',
  'focus-and-forms',
  'shadow-dom',
  'frames',
  'mutation-clock',
  'geometry-and-scroll',
  'pointer-state',
  'focus-context',
  'viewport-boundaries',
  'nested-shadow-dom',
  'nested-frames',
  'dom-extremes',
  'deep-tree',
  'virtualized-list',
  'sensitive-data',
  'rendering-boundaries',
  'frame-churn',
  'hostile-prototypes',
  'scale-wide',
  'chaos-laboratory'
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const shell = (name, seed, body, script = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Domstamp Gym · ${escapeHtml(name)}</title>
  <style>
    * { box-sizing: border-box; }
    html { font: 16px/1.4 system-ui, sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; padding: 24px; min-height: 100vh; }
    main { max-width: 900px; margin: auto; }
    section { padding: 16px; margin: 12px 0; border: 1px solid #aeb8cc; background: white; }
    button, input, select, textarea { font: inherit; }
    .offscreen { position: absolute; left: -10000px; }
    .sr-only { clip: rect(0 0 0 0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; width: 1px; }
  </style>
</head>
<body data-scenario="${escapeHtml(name)}" data-seed="${seed}">
  <main><h1>${escapeHtml(name)}</h1>${body}</main>
  <script>
    window.__GYM__ = {
      seed: ${seed},
      ticks: 0,
      epoch: 0,
      pointer: { x: 0, y: 0, type: 'none', buttons: 0 },
      tick() { throw new Error('This scenario has no deterministic clock'); }
    };
    addEventListener('pointermove', event => {
      window.__GYM__.pointer = { x: event.clientX, y: event.clientY, type: event.pointerType, buttons: event.buttons };
    }, { passive: true });
    new MutationObserver(records => {
      window.__GYM__.epoch += records.length;
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    ${script}
  </script>
</body>
</html>`;

const scenarios = {
  'document-kitchen-sink': ({ seed }) => shell('document-kitchen-sink', seed, `
    <!-- comment-node-${seed} -->
    <section id="semantics" data-seed="${seed}">
      <h2>Semantic structure</h2>
      <p>Text before <strong>nested emphasis ${seed}</strong> text after.</p>
      <ul><li>alpha</li><li hidden>hidden item</li><li aria-hidden="true">aria hidden</li></ul>
      <details open><summary>More</summary><p>Expanded content</p></details>
      <div inert><button>Inert action</button></div>
      <span class="offscreen">Offscreen but rendered</span>
      <span class="sr-only">Screen reader only</span>
    </section>`),

  'focus-and-forms': ({ seed }) => shell('focus-and-forms', seed, `
    <section>
      <label for="name">Name</label>
      <input id="name" name="name" value="markup-${seed}" autocomplete="off">
      <label><input id="enabled" type="checkbox" checked> Enabled</label>
      <label for="tier">Tier</label>
      <select id="tier"><option>free</option><option selected>pro</option><option>enterprise</option></select>
      <textarea id="notes">markup notes</textarea>
      <button id="submit">Submit</button>
      <div id="editable" contenteditable="true">editable value</div>
    </section>`, `
      const input = document.querySelector('#name');
      input.value = 'runtime-${seed}';
      input.focus();
      input.setSelectionRange(2, 7, 'forward');
      document.querySelector('#enabled').indeterminate = true;
      document.querySelector('#notes').value = 'runtime notes ${seed}';
    `),

  'sensitive-data': ({ seed }) => shell('sensitive-data', seed, `
    <section class="secret-zone" data-token="sentinel-${seed}">
      <label for="credential">Credential sentinel-${seed}</label>
      <input id="credential" name="credential" value="markup-sentinel-${seed}">
      <p id="secret-description">Visible sentinel-${seed}</p>
    </section>
    <p id="public-copy">Public stable copy</p>`, `
      const input = document.querySelector('#credential');
      input.value = 'runtime-sentinel-${seed}';
      input.setAttribute('aria-describedby', 'secret-description');
    `),

  'shadow-dom': ({ seed }) => shell('shadow-dom', seed, `
    <section><h2>Component boundary</h2>
      <gym-card id="card"><span slot="title">Slotted title ${seed}</span><b>Default slot</b></gym-card>
    </section>`, `
      const host = document.querySelector('#card');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>:host{display:block}</style><article><h3><slot name="title"></slot></h3><slot></slot><button id="shadow-action">Shadow action</button></article>';
      root.querySelector('button').focus();
    `),

  frames: ({ seed, peerOrigin }) => shell('frames', seed, `
    <section>
      <h2>Browsing contexts</h2>
      <iframe id="same-origin" title="same origin" src="/frame/nested?seed=${seed}"></iframe>
      <iframe id="cross-origin" title="cross origin" src="${escapeHtml(peerOrigin)}/frame/nested?seed=${seed + 1}"></iframe>
    </section>`),

  'mutation-clock': ({ seed }) => shell('mutation-clock', seed, `
    <section><h2>Deterministic mutations</h2><ol id="events"><li data-tick="0">seed-${seed}</li></ol></section>`, `
      window.__GYM__.tick = (count = 1) => {
        for (let step = 0; step < count; step += 1) {
          window.__GYM__.ticks += 1;
          const item = document.createElement('li');
          item.dataset.tick = String(window.__GYM__.ticks);
          item.textContent = 'event-' + window.__GYM__.seed + '-' + window.__GYM__.ticks;
          document.querySelector('#events').append(item);
        }
        return window.__GYM__.ticks;
      };
    `),

  'geometry-and-scroll': ({ seed }) => shell('geometry-and-scroll', seed, `
    <style>
      #scrollbox { width: 320px; height: 180px; overflow: scroll; border: 4px solid #31466e; }
      #scroll-content { width: 700px; height: 900px; position: relative; background: linear-gradient(#eef2ff, #fff); }
      #target { position: absolute; left: 430px; top: 610px; width: 120px; height: 44px; transform: translate(3px, 5px); }
      #overlap { position: fixed; left: 40px; top: 40px; z-index: 10; opacity: .8; }
    </style>
    <section><div id="scrollbox"><div id="scroll-content"><button id="target">Target ${seed}</button></div></div></section>
    <div id="overlap">fixed overlay</div>`, `
      const box = document.querySelector('#scrollbox');
      box.scrollLeft = 375;
      box.scrollTop = 555;
    `),

  'pointer-state': ({ seed }) => shell('pointer-state', seed, `
    <section><button id="pointer-target" style="width:180px;height:80px">Pointer target ${seed}</button></section>`),

  'focus-context': ({ seed }) => shell('focus-context', seed, `
    <section id="noise-zone">${Array.from({ length: 200 }, (_, index) => `<span data-noise="${index}">noise-${seed}-${index}</span>`).join('')}</section>
    <section id="task-context">
      <h2 id="task-title">Checkout</h2>
      <p id="nearby-before">Use the billing identity.</p>
      <input id="focused-control" aria-labelledby="task-title" aria-describedby="remote-help" value="account-${seed}">
      <p id="nearby-after">The charge is reversible.</p>
    </section>
    <aside id="remote-help">Account identifier from the external payment provider.</aside>`, `
      document.querySelector('#focused-control').focus();
    `),

  'viewport-boundaries': ({ seed }) => shell('viewport-boundaries', seed, `
    <section id="visible-region"><button id="visible-action">Visible ${seed}</button></section>
    <section id="below-fold" style="position:absolute;top:1800px"><button id="far-action">Far away</button></section>
    <section id="display-none" style="display:none"><button>Not rendered</button></section>`),

  'nested-shadow-dom': ({ seed }) => shell('nested-shadow-dom', seed, `
    <section><outer-shell id="outer"><span slot="heading">Nested ${seed}</span></outer-shell></section>`, `
      const outer = document.querySelector('#outer').attachShadow({ mode: 'open' });
      outer.innerHTML = '<article><slot name="heading"></slot><inner-shell id="inner"></inner-shell></article>';
      const inner = outer.querySelector('#inner').attachShadow({ mode: 'open' });
      inner.innerHTML = '<div><button id="deep-shadow-action">Deep action</button></div>';
      inner.querySelector('button').focus();
    `),

  'nested-frames': ({ seed, peerOrigin }) => shell('nested-frames', seed, `
    <section><iframe id="frame-level-1" title="nested frame chain" src="${escapeHtml(peerOrigin)}/frame/nested?seed=${seed}&depth=2"></iframe></section>`),

  'dom-extremes': ({ seed }) => shell('dom-extremes', seed, `
    <section id="unicode" dir="auto">
      <p>Latin café — العربية — עברית — हिन्दी — 日本語 — 👩🏽‍🚀 — e&#x301; — ${seed}</p>
      <svg id="vector" viewBox="0 0 20 20"><title>Vector title</title><circle cx="10" cy="10" r="8"/></svg>
      <math id="equation"><mrow><mi>x</mi><mo>=</mo><mn>${seed}</mn></mrow></math>
      <template id="dormant"><button>Template content</button></template>
      <div data-empty="" data-symbols="&quot;&amp;&lt;&gt;">namespace boundary</div>
    </section>`),

  'deep-tree': ({ seed }) => shell('deep-tree', seed, `
    <section id="deep-root">${Array.from({ length: 320 }, (_, index) => `<div data-depth="${index}">`).join('')}<button id="deep-leaf">Leaf ${seed}</button>${'</div>'.repeat(320)}</section>`, `
      document.querySelector('#deep-leaf').focus();
    `),

  'virtualized-list': ({ seed }) => shell('virtualized-list', seed, `
    <section><h2>Virtual results</h2><div id="virtual-window" role="list"></div></section>`, `
      const render = () => {
        const start = window.__GYM__.ticks * 10;
        document.querySelector('#virtual-window').innerHTML = Array.from({ length: 10 }, (_, offset) => {
          const index = start + offset;
          return '<button role="listitem" data-row="' + index + '">row-' + window.__GYM__.seed + '-' + index + '</button>';
        }).join('');
      };
      window.__GYM__.tick = (count = 1) => {
        window.__GYM__.ticks += count;
        render();
        return window.__GYM__.ticks;
      };
      render();
    `),

  'rendering-boundaries': ({ seed }) => shell('rendering-boundaries', seed, `
    <style>
      #generated::before { content: "before-${seed}"; }
      #generated::after { content: "after-${seed}"; }
      #clipped { width: 80px; height: 32px; overflow: hidden; transform: rotate(.01deg); }
    </style>
    <section>
      <p id="generated">Generated boundary</p>
      <div id="clipped">Clipped visual content ${seed}</div>
      <canvas id="bitmap" width="180" height="72" aria-label="Generated chart"></canvas>
      <closed-widget id="closed-widget"></closed-widget>
    </section>`, `
      const canvas = document.querySelector('#bitmap');
      const context = canvas.getContext('2d');
      context.fillStyle = '#173f5f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f6d55c';
      context.font = '20px sans-serif';
      context.fillText('pixel-${seed}', 18, 42);
      const closed = document.querySelector('#closed-widget').attachShadow({ mode: 'closed' });
      closed.innerHTML = '<button>inaccessible closed control</button>';
    `),

  'frame-churn': ({ seed }) => shell('frame-churn', seed, `
    <section id="frame-churn-zone"><iframe id="churn-frame" title="churning frame" src="/frame/nested?seed=${seed}"></iframe></section>`, `
      let enabled = false;
      let frameNumber = 0;
      const zone = document.querySelector('#frame-churn-zone');
      const churn = () => {
        if (!enabled) return;
        const existing = document.querySelector('#churn-frame');
        if (existing) existing.remove();
        const frame = document.createElement('iframe');
        frame.id = 'churn-frame';
        frame.title = 'churning frame';
        frame.src = '/frame/nested?seed=' + (${seed} + (++frameNumber));
        zone.append(frame);
        requestAnimationFrame(churn);
      };
      window.__GYM__.startFrameChurn = () => { enabled = true; requestAnimationFrame(churn); };
      window.__GYM__.stopFrameChurn = () => { enabled = false; };
    `),

  'hostile-prototypes': ({ seed }) => shell('hostile-prototypes', seed, `
    <section><button id="hostile-target">Hostile ${seed}</button></section>`, `
      window.__GYM__.armHostility = () => {
        Element.prototype.getBoundingClientRect = function () { throw new Error('hostile geometry trap'); };
      };
    `),

  'scale-wide': ({ seed }) => shell('scale-wide', seed, `
    <section><h2>Wide DOM pressure</h2><div id="scale-root"></div></section>`, `
      const requested = Number(new URL(location.href).searchParams.get('nodes') || 25000);
      const count = Math.max(1, Math.min(requested, 1000000));
      const root = document.querySelector('#scale-root');
      const batchSize = 5000;
      for (let start = 0; start < count; start += batchSize) {
        const fragment = document.createDocumentFragment();
        for (let index = start; index < Math.min(start + batchSize, count); index += 1) {
          const item = document.createElement('i');
          item.dataset.scale = String(index);
          item.textContent = index % 1000 === 0 ? 'milestone-${seed}-' + index : '';
          fragment.append(item);
        }
        root.append(fragment);
      }
      document.body.dataset.nodeCount = String(count);
    `),

  'chaos-laboratory': ({ seed }) => shell('chaos-laboratory', seed, `
    <style>
      #chaos-scroll { height: 120px; overflow: auto; border: 2px solid #536789; }
      #chaos-scroll-content { height: 700px; padding-top: 540px; }
    </style>
    <section id="chaos-form">
      <label for="chaos-input">Account</label>
      <input id="chaos-input" value="initial-${seed}" aria-describedby="chaos-help">
      <p id="chaos-help">Chaos-safe account identifier</p>
      <button id="chaos-button" type="button">Apply</button>
    </section>
    <section id="chaos-panels">
      <article data-panel="0">Panel zero</article>
      <article data-panel="1">Panel one</article>
      <article data-panel="2">Panel two</article>
    </section>
    <section><ol id="chaos-list">${Array.from({ length: 8 }, (_, index) => `<li data-item="${index}">item-${seed}-${index}</li>`).join('')}</ol></section>
    <section><div id="chaos-scroll"><div id="chaos-scroll-content"><button id="scroll-action">Scrolled action</button></div></div></section>
    <section id="chaos-frame-zone"><iframe id="chaos-frame" title="chaos frame" src="/frame/nested?seed=${seed}"></iframe></section>
    <section><chaos-shell id="chaos-shadow"><span id="chaos-slot-value" slot="label">slot-${seed}</span></chaos-shell></section>
    <output id="chaos-network" aria-live="polite">network-idle</output>
    <div id="chaos-live" aria-live="assertive"></div>`, `
      const shadowHost = document.querySelector('#chaos-shadow');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button id="chaos-shadow-button"><slot name="label"></slot></button><slot></slot>';
      const frameZone = document.querySelector('#chaos-frame-zone');
      const frameSource = '/frame/nested?seed=${seed}';
      const focusTargets = [
        () => document.querySelector('#chaos-input'),
        () => document.querySelector('#chaos-button'),
        () => document.querySelector('#scroll-action'),
        () => shadow.querySelector('#chaos-shadow-button')
      ];
      window.__GYM__.chaos = async action => {
        switch (action.kind) {
          case 'focus': {
            focusTargets[action.target % focusTargets.length]().focus();
            break;
          }
          case 'edit': {
            const input = document.querySelector('#chaos-input');
            input.value = action.value;
            input.setSelectionRange(1, Math.min(5, input.value.length), 'forward');
            break;
          }
          case 'visibility': {
            const panels = [...document.querySelectorAll('[data-panel]')];
            const panel = panels[action.target % panels.length];
            panel.hidden = !panel.hidden;
            break;
          }
          case 'reorder': {
            const list = document.querySelector('#chaos-list');
            if (list.firstElementChild) list.append(list.firstElementChild);
            break;
          }
          case 'replace': {
            const panels = [...document.querySelectorAll('[data-panel]')];
            const panel = panels[action.target % panels.length];
            const replacement = panel.cloneNode(true);
            replacement.textContent = 'replacement-' + action.value;
            panel.replaceWith(replacement);
            break;
          }
          case 'scroll': {
            document.querySelector('#chaos-scroll').scrollTop = action.target % 580;
            break;
          }
          case 'frame-toggle': {
            const existing = document.querySelector('#chaos-frame');
            if (existing) existing.remove();
            else {
              const iframe = document.createElement('iframe');
              iframe.id = 'chaos-frame';
              iframe.title = 'chaos frame';
              iframe.src = frameSource;
              frameZone.append(iframe);
            }
            break;
          }
          case 'frame-navigate': {
            const iframe = document.querySelector('#chaos-frame');
            if (iframe) iframe.src = '/frame/nested?seed=' + action.target;
            break;
          }
          case 'slot': {
            const value = document.querySelector('#chaos-slot-value');
            value.slot = value.slot ? '' : 'label';
            value.textContent = action.value;
            break;
          }
          case 'tick': {
            window.__GYM__.ticks += 1;
            const event = document.createElement('p');
            event.dataset.chaosTick = String(window.__GYM__.ticks);
            event.textContent = action.value;
            const live = document.querySelector('#chaos-live');
            live.append(event);
            while (live.childElementCount > 5) live.firstElementChild.remove();
            break;
          }
          case 'network': {
            const output = document.querySelector('#chaos-network');
            try {
              const response = await fetch('/api/chaos?seed=' + action.target + '&fault=' + action.value);
              await response.text();
              output.textContent = response.ok ? 'network-ok-' + action.target : 'network-status-' + response.status;
            } catch {
              output.textContent = 'network-error';
            }
            break;
          }
          default: throw new Error('Unknown chaos action: ' + action.kind);
        }
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        return { frames: document.querySelectorAll('iframe').length, ticks: window.__GYM__.ticks };
      };
    `)
};

export function renderScenario(name, context) {
  return scenarios[name](context);
}
