# B20 accessibility evidence dossier

## Status

This is an auditable candidate dossier, not a WCAG conformance declaration. Automated evidence must pass on the exact PR HEAD and every applicable row in `tests/accessibility/manual-wcag-checklist.md` must be executed before T088 can close.

## Authority and traceability

- Scope: B20 / T086 → T087 → T088.
- Matrix: `specs/001-fundamental-analysis-platform/definitions/wcag-2.2-aa-matrix.json` (55 criteria: 43 applicable, 12 N/A).
- Oracle inventory: `specs/001-fundamental-analysis-platform/fixtures/accessibility/wcag-oracle-inventory.json`.
- Deterministic browser evidence: `tests/accessibility/wcag-automated.spec.ts` and `tests/e2e/accessibility/names-errors.spec.ts`.
- Manual evidence: `tests/accessibility/manual-wcag-checklist.md`.
- Axe is supplemental only and never replaces deterministic or manual oracles.

## T086 implemented surfaces

The functional views and `RecoveryPanel.svelte` expose explicit labels and instructions, programmatic error relationships, announced states/results, textual fact/rule/quality states, table/chart alternatives, destructive-action consequences and keyboard-reachable recovery. Financial formulas, persistence contracts and SEC gateway behavior are unchanged.

## T087 automated evidence contract

Every automated plan records the WCAG ID, AC IDs, route/surface, deterministic oracle, evidence source, pending execution result and whether manual closure remains required. The loader fails closed on matrix/oracle count or applicability drift. Automated PASS never converts a manual-required criterion into automated-only coverage.

## T088 manual execution gate

The checklist contains all 55 WCAG 2.2 A/AA criteria and exactly 12 N/A rows. Each N/A row records basis, evaluated scope, oracle, evidence, result and a concrete reopening condition. Applicable checks remain `PENDING` until executed on the exact candidate HEAD with tester/environment metadata and evidence hashes.

Required observations include keyboard operation, visible and unobscured focus plus focus return, dialogs, errors/instructions, live regions, busy/disabled states, tables/charts, names, contrast, text spacing, 200% zoom, 320 CSS px reflow, targets, reduced motion, persistent context, recovery, non-color meaning and absence of personalized financial advice.

## Product boundary

FinScope provides deterministic descriptive analysis. It does not personalize recommendations, promise returns, provide target prices or present price overlays as fundamental valuation. The disclosure and rule outcomes remain textually available.

## Promotion rule

T088 and B20 must remain pending or `LOCAL_VALIDATION_REQUIRED` while any applicable manual row is unexecuted or failed. B21 and convergence remain prohibited until a later authorized closure conversation authenticates the exact evidence.
