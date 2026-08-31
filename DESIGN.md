---
name: Domstamp Documentation
description: A restrained evidence ledger for a browser-state capture library.
colors:
  evidence-teal: "#0c7167"
  evidence-teal-deep: "#07564f"
  evidence-teal-soft: "#d8ece6"
  paper: "#f6f3e9"
  paper-deep: "#ebe7d9"
  mineral-ink: "#182825"
  muted-ink: "#56635f"
  ledger-rule: "#c9c9bc"
  exception-rust: "#a84d2b"
  exception-rust-soft: "#f3dfd3"
typography:
  display:
    fontFamily: "Newsreader Variable, serif"
    fontSize: "clamp(2.1rem, 5vw, 3.4rem)"
    fontWeight: 590
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Newsreader Variable, serif"
    fontSize: "1.45rem"
    fontWeight: 590
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  body:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.72
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.05em"
rounded:
  inline-code: "0.2rem"
  field: "0.35rem"
spacing:
  xs: "0.35rem"
  sm: "0.55rem"
  md: "0.9rem"
  lg: "1.6rem"
  section: "3.6rem"
components:
  primary-action:
    backgroundColor: "{colors.mineral-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "0.65rem 0.9rem"
  search-field:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.mineral-ink}"
    rounded: "{rounded.field}"
  status-supported:
    textColor: "{colors.evidence-teal-deep}"
    typography: "{typography.label}"
  status-unavailable:
    textColor: "{colors.exception-rust}"
    typography: "{typography.label}"
---

# Design System: Domstamp Documentation

## Overview

**Creative North Star: "The Capture Ledger"**

Domstamp's documentation behaves like an exact technical field ledger: calm, compact, and accountable. Warm paper surfaces make long reading comfortable; mineral ink and fine rules establish hierarchy; scarce evidence teal marks navigation, support, and action. The interface should feel editorial without becoming literary, and technical without resembling a generic developer portal.

The system favors searchable knowledge, explicit capability boundaries, and information density over promotional composition. It deliberately rejects an oversized hero, ornamental gradients, inflated cards, and theatrical motion. Responsive transformations must preserve every fact instead of hiding overflow.

**Key Characteristics:**

- Warm paper and mineral-ink materiality in light mode, with a purpose-built dark theme.
- Editorial serif headings paired with highly legible sans-serif prose and monospaced evidence labels.
- Thin rules, tabular structures, and small square status marks in place of decorative containers.
- Evidence teal is reserved for action, focus, active navigation, and confirmed support.
- Motion is rare, brief, and disabled when reduced motion is requested.

## Colors

The palette is quiet and archival: one cool evidence accent, warm neutral surfaces, and rust only for declared exceptions.

### Primary

- **Evidence Teal:** links, focus rings, the active navigation marker, supported status marks, and the capture-pipeline rule.
- **Deep Evidence Teal:** accessible text links and hover/action states on warm paper.
- **Soft Evidence Teal:** low-emphasis accent surfaces and theme integration.

### Secondary

- **Exception Rust:** unsupported and unavailable states; it never competes with the primary action color.
- **Soft Exception Rust:** low-emphasis exception surfaces when a filled treatment is necessary.

### Neutral

- **Ledger Paper:** the main reading surface and inverse text on dark controls.
- **Deep Ledger Paper:** sidebar, inline-code, and search-field surfaces.
- **Mineral Ink:** primary prose, headings, and the principal action surface.
- **Muted Ink:** supporting copy and metadata.
- **Ledger Rule:** borders, dividers, and table structure.

The dark theme remaps the same semantic roles rather than introducing a different palette. It uses deep green-black surfaces, pale mineral text, brighter teal, and strengthened shadows while preserving the same hierarchy.

### Named Rules

**The Evidence Accent Rule.** Teal identifies interaction or verified support; it is not a decorative wash.

**The Honest Exception Rule.** Rust communicates a real unavailable boundary, never ordinary emphasis.

## Typography

**Display Font:** Newsreader Variable (with serif fallback)

**Body Font:** IBM Plex Sans Variable (with sans-serif fallback)

**Label/Mono Font:** IBM Plex Mono (with monospace fallback)

**Character:** Newsreader gives headings the authority of a well-edited technical manual. IBM Plex keeps prose, navigation, metadata, and code precise and contemporary.

### Hierarchy

- **Display:** page titles only, balanced and constrained to a short measure.
- **Headline:** section headings and ledger group titles; editorial but compact.
- **Body:** documentation prose with generous leading and a maximum readable measure of about 70 characters.
- **Label:** status, timing, version, schema, table headers, and navigation group metadata; uppercase only where the implementation establishes that convention.
- **Code:** IBM Plex Mono at a slightly reduced relative size so inline code sits naturally within prose.

### Named Rules

**The Three-Voice Rule.** Serif explains hierarchy, sans serif carries knowledge, and mono records evidence; do not exchange their roles casually.

**The Legibility Floor Rule.** Responsive metadata does not fall below the implemented 0.75rem label size and 1.45 line height.

## Layout

Starlight supplies the documentation shell, with an 18rem sidebar and a 48rem content measure. The home view enters directly into release evidence and a concise product statement, then uses a four-stage pipeline, paired route lists, and capability rows. Major sections are separated by generous vertical space and one-pixel rules rather than card grids.

At 44rem, paired route columns stack, the four-stage pipeline becomes a two-column grid, metadata alignment becomes left-aligned, and package tables transform into labelled record rows so no column is clipped. At 28rem, the pipeline becomes one column and capability rows stack. The site-title suffix disappears only below 24rem.

**The Lossless Responsive Rule.** A smaller viewport may transform structure, but it must not remove package fields, capability boundaries, or status meaning.

## Elevation & Depth

The system is flat by default. One-pixel tonal borders and alternating paper surfaces carry most depth. Soft shadows are limited to the sticky header and framed code, where separation materially improves orientation; ordinary content rows and pagination controls remain unlifted.

### Shadow Vocabulary

- **Ledger Frame:** a broad, low-opacity green-black shadow for code frames.
- **Header Veil:** a subtler shadow paired with background blur on the persistent header.
- **Dark Ledger Frame:** a stronger black shadow used only when the dark theme requires equivalent separation.

### Named Rules

**The Flat Ledger Rule.** Structure comes from rules and tonal surfaces first; shadow is functional separation, not ornament.

## Shapes

The form language is nearly square. Interactive fields, asides, pagination, primary actions, and code frames share a restrained 0.35rem corner; inline code uses an even tighter 0.2rem corner. Status marks and active-navigation indicators are true squares. Borders remain one pixel, and the site mark uses square-ended strokes.

## Components

### Primary Action

- **Shape:** gently squared field radius with compact horizontal padding.
- **Color:** mineral-ink surface with paper text; hover changes to deep evidence teal.
- **Focus:** the global three-pixel evidence-teal outline remains visible outside the component.

### Search Field

- **Style:** deep-paper surface, one-pixel ledger-rule border, and no shadow.
- **Hover / Focus:** hover changes the border to evidence teal; keyboard focus uses the global outline.

### Release Strip

- **Style:** a border-block ledger with monospaced uppercase metadata and vertical separators between facts.
- **Responsive:** separators are removed at the narrowest width when facts wrap.

### Capture Pipeline

- **Style:** four accountable stages in a ruled grid with a thin teal line across the leading edge.
- **Motion:** the teal line reveals once over 700ms with an emphasized deceleration curve, only when reduced motion is not requested.

### Route Rows

- **Style:** border-separated text links with a right-aligned monospaced type or time label.
- **Hover:** link ink changes to deep teal and its underline becomes visible.

### Capability Status

- **Supported:** teal text with a filled square mark.
- **Unavailable:** rust text with a hollow square mark.
- **Semantics:** the text label always carries the meaning; color and shape reinforce it.

### Package Table

- **Desktop:** a semantic table within a keyboard-focusable, horizontally contained region.
- **Mobile:** each row becomes a labelled field/value record; the header remains available to assistive technology through the cell labels.

### Navigation

- **Style:** compact sans-serif links beneath monospaced uppercase section labels.
- **Active:** deep teal text, stronger weight, and a small teal square at the leading edge; no filled pill.

## Do's and Don'ts

### Do:

- **Do** make availability, schema, version, and test status explicit.
- **Do** use one-pixel rules and tonal surfaces to establish information structure.
- **Do** preserve visible focus, semantic labels, reduced-motion behavior, and mobile information completeness.
- **Do** keep introductory copy compact enough that documentation begins above the fold.

### Don't:

- **Don't** add an oversized hero, ornamental gradient, or promotional illustration to the documentation home.
- **Don't** use teal as a general background decoration or rust for ordinary emphasis.
- **Don't** turn navigation items, capability rows, or route lists into a field of floating rounded cards.
- **Don't** reduce metadata below its responsive legibility floor or solve narrow layouts by clipping content.
