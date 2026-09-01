# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro Starlight, confirmed by the user, deployed as a static GitHub Pages site. The documentation build is code-first.

## Users

TypeScript engineers, browser-automation engineers, and teams building AI agents that need a precise account of browser state. They use the documentation while evaluating Domstamp, integrating the Playwright adapter, configuring captures, authoring adapters or plugins, and diagnosing incomplete or unstable snapshots.

## Product Purpose

Domstamp captures the browser state an automation agent can perceive at a specific moment. The documentation must make the public TypeScript API, snapshot model, browser boundaries, operational limits, TQ1 transport, conformance gym, and security implications understandable and searchable.

## Positioning

Domstamp separates a zero-runtime-dependency orchestration core from typed browser-driver adapters. It treats accessible DOM, frame ownership, interaction state, consistency, and bounded transport as one validated snapshot contract without coupling consumers to an application framework.

## Operating Context

Readers work in TypeScript projects, Playwright automation, CI environments, Dockerized browser matrices, and npm package integrations. They need copyable examples, exact option semantics, stable error codes, capability boundaries, and direct routes from a problem to the relevant reference material.

## Capabilities and Constraints

- The current public package set is `domstamp`, `@domstamp/playwright`, `@domstamp/puppeteer`, and `@domstamp/tq1`; npm publication is still pending.
- The core is application-framework and browser-driver independent through generic adapters.
- The Playwright adapter supports accessible DOM, open Shadow DOM, template contents, interaction state, same- and cross-origin frames, ARIA perception trees, screenshots, and masked pixels.
- The Puppeteer adapter proves cross-driver DOM capture but does not advertise accessibility or pixels.
- Trusted structural redaction is implemented in the core. Closed Shadow DOM and native OS accessibility trees remain explicit unsupported boundaries.
- Documentation must build statically for GitHub Pages and support repository subpaths.
- Search must work without a hosted search service.
- Schema 2 explicitly migrates historical schema-1 snapshots, but the long-term compatibility window is not frozen for 1.0.

## Brand Commitments

The product name is Domstamp. Voice should be technically exact, candid about boundaries, and useful to experienced TypeScript engineers without becoming opaque to new adapter authors. The user explicitly requested an elegant knowledge base with no oversized or theatrical hero section.

## Evidence on Hand

The repository contains the implementation, package READMEs, public API contract, security guidance, chaos methodology, Docker gym documentation, design review, conformance tests, a three-browser validation matrix, and a real Puppeteer adapter test. No testimonials, customer logos, production adoption claims, or published hardware benchmarks exist and none may be fabricated.

## Product Principles

- Framework neutrality is structural, not a marketing claim.
- Unsupported browser boundaries remain explicit.
- Defaults are safe, bounded, and overridable.
- Examples should be executable and type-correct.
- Documentation should reveal uncertainty and compatibility commitments honestly.

## Accessibility & Inclusion

The documentation should meet WCAG 2.2 AA expectations, support keyboard navigation and reduced motion, preserve readable line lengths, and remain usable on narrow screens and at browser zoom.
