# Accessibility evidence — B20 candidate

## Status

B20 creates a traceable WCAG 2.2 A/AA evidence system for FinScope Analytics. It does **not** claim completed conformance in this candidate document.

- Matrix: 55 criteria.
- Applicable: 43.
- N/A: exactly 12, each retained from the normative matrix with a justification and concrete reopening condition.
- Automated evidence: `tests/accessibility/wcag-automated.spec.ts` and `tests/e2e/accessibility/names-errors.spec.ts`.
- Manual evidence: `tests/accessibility/manual-wcag-checklist.md`.
- Current manual result: `LOCAL_VALIDATION_REQUIRED` until a human executes every applicable manual procedure against the exact candidate HEAD.
- Axe: supplemental only; deterministic oracles and manual review remain authoritative.

## T086 — accessible views and actions

The B20 view changes provide:

- visible and programmatic labels that do not depend on placeholders;
- unique action names, including metric evidence and issue-specific recovery actions;
- explicit formats, prerequisites, preserved state and destructive consequences;
- `aria-invalid`, `aria-errormessage` and descriptions linking errors to issuer, acquisition, price and deletion fields;
- atomic polite/assertive live regions and `aria-busy`/disabled semantics;
- text states for unavailable, not applicable, source quality and rule outcomes;
- captions, scoped headers, chart descriptions and a complete equivalent price table;
- interface-reachable recovery operations with focus moved to the resulting target;
- persistent issuer CIK, period, profile and snapshot context in evidence, metric, insight and price-analysis views;
- an explicit non-personalized, descriptive-only and not-investment-advice boundary.

The deterministic end-to-end oracle is `tests/e2e/accessibility/names-errors.spec.ts`.

## T087 — automated WCAG evidence

`tests/accessibility/wcag-matrix-loader.ts` authenticates structural invariants between the normative matrix and oracle inventory:

- 55 unique criterion IDs;
- 43 applicable criteria;
- exactly 12 N/A;
- one matching fixture oracle per criterion;
- matching applicability, automation and manual-review flags;
- a justification and reopening trigger for every N/A.

`tests/accessibility/wcag-automated.spec.ts` creates one evidence record for every automatable applicable criterion. Each record contains:

- WCAG matrix ID;
- linked AC IDs;
- view and control/flow;
- deterministic oracle;
- concrete test evidence;
- coverage classification (`FULLY_AUTOMATED` or `AUTOMATED_PORTION_ONLY`);
- result semantics tied to the referenced test.

Criteria whose authority requires manual review remain `AUTOMATED_PORTION_ONLY`; an automated PASS cannot promote them to manual PASS.

## T088 — manual auditable evidence

The manual checklist contains all 55 criterion records and the required cross-cutting scenarios:

- keyboard operation;
- visible, unobscured and restored focus;
- modal and destructive confirmations;
- errors and instructions;
- live regions and busy/disabled states;
- tables and graphs;
- accessible names;
- contrast and non-text contrast;
- text spacing;
- 200% zoom;
- 320 CSS px reflow;
- target size;
- reduced motion;
- persistent context;
- error recovery;
- no color-only information;
- no personalized financial advice.

Every applicable criterion remains `PENDING_LOCAL_VALIDATION` until evidence is collected honestly. Every N/A requires exact-head scope reconfirmation and has a reopening trigger. Therefore T088 must not be marked complete solely from this document or from automated results.

## Evidence acceptance rule

An accepted B20 candidate must bind all workflow logs and artifacts to the exact HEAD, execute the literal commands from `implementation-control/batches/B20.json`, preserve failed runs, and report discovered/PASS/FAIL/SKIP counts. Manual evidence must additionally identify the human operator, ISO timestamp, browser/assistive-technology environment and evidence artifact. B21 and convergence remain out of scope.
