# B08 r1 validation failure and r2 remediation

## Evidence authenticated

- Evidence: `FinScope_local_evidence_B08_20260726-235329530_FAILED.zip`
- SHA-256: `5c89875412ec3ccf7649290c99c3a061591e7009b7c86a9f496c7badb4e0739b`
- Candidate r1: `FS_B08_r1.zip` (`0a3a925d1477ea9d5ff43db6af60ac8aa023c6dc64a6929e7c93ddc6669d775a`)
- Runner: `Run-FinScope-BatchValidation_B08_r1_v1.ps1` (`4105d3bb43c214ea82e163136fd9a45dcc90ec0f7ca04c5fd269af4d20a4c468`)
- ZIP CRC, evidence sidecar, candidate sidecar, runner sidecar, manifest, inventory, evidence schema and control plane: consistent.

## Exact execution result

1. `npm ci`: PASS.
2. `npm run typecheck`: PASS.
3. Targeted unit suite: FAIL; 5 files discovered, 20 tests discovered, 19 passed and 1 failed.
4. `npm run test`: `NOT_RUN` by fail-fast.
5. `npm run build`: `NOT_RUN` by fail-fast.

## Root cause

`tests/unit/fundamental/fact-sanitizer.test.ts` expected the sanitized facts in `factId` order (`a`, `z`). The production sanitizer returned `z`, `a` because the active fingerprint authority orders facts by:

1. `canonicalConceptId`;
2. `periodId`;
3. `scopeId`;
4. `factId`.

This order is defined by `specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json#/arrayOrdering/facts`. With `netIncome` for `z` and `revenue` for `a`, `z` must precede `a`. The production implementation was correct; the r1 test oracle was incorrect.

## Alternatives and risk

- **Applied:** correct only the test oracle. Functional risk: **none**; no runtime function, data path, authority, fixture or fingerprint algorithm changes.
- Change the fixture so both facts share one concept: low risk but weaker coverage; rejected.
- Change production sorting to `factId` only, preserve input order or skip the test: high risk because it violates AUTH-014 and can change fingerprints; rejected.

## Scope of r2

- Product runtime: byte-identical to r1.
- Changed executable test: `tests/unit/fundamental/fact-sanitizer.test.ts`.
- Frozen fixtures, `.specify`, `spec.md`, `tasks.md`, FR/NFR/AC and `B08.json`: unchanged.
- Runner logic: unchanged; identity updated to `Run-FinScope-BatchValidation_B08_r2_v1.ps1` because the candidate changed.
- B08 remains `LOCAL_VALIDATION_REQUIRED`; T036–T040 remain `IMPLEMENTED_PENDING_VALIDATION`; B09 remains `PENDING`; convergence remains closed.

## Closure rule

The two r1 PASS commands cannot be reused to promote r2. The exact r2 candidate must execute the complete five-command sequence and return authenticated PASS evidence.
