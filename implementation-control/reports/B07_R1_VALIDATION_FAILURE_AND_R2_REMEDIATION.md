# B07 r1 validation failure and r2 remediation

## Evidence authenticated

- Evidence: `FinScope_local_evidence_B07_20260726-201038455_FAILED.zip`
- SHA-256: `50860118aa006cda58c38fd033781e85a99dbafbe8a573d4979ed0169af33b8e`
- Candidate r1: `FS_B07_r1.zip` (`2a7b921bb8bd797e156b2d57a331d4a17dfb4ef370ad5c036d2fa57e0178adbe`)
- Runner: `Run-FinScope-BatchValidation_B07_r1_v2.ps1` (`5fb3410bafc6bac1293e3aa2f76000b582c23d72144dc7b03357a707d1f34683`)
- ZIP CRC, evidence sidecar, candidate sidecar, runner sidecar, manifest and inventory: consistent.

## Exact execution result

1. `npm ci`: PASS.
2. `npm exec playwright install chromium`: PASS.
3. `npm run typecheck`: PASS.
4. Targeted unit suite: FAIL, 2 files discovered, 6 tests discovered, 5 passed and 1 failed.
5. Remaining seven commands: `NOT_RUN` by fail-fast.

## Root cause

`tests/unit/fundamental/filing-selection.test.ts` expected `state: not_found` for a candidate carrying `frame: CY2025`. That oracle contradicted both active authorities:

- `contracts/sec-filing-fact-selection-policy.json`: Frames must never select an issuer fact, but an existing frame value is preserved as evidence metadata.
- `fixtures/sec/sec-selection-test-vectors.json`, vector `frame-ignored-for-selection`: `expectedFrameRole = evidence_only`.

The production selector already returned `evidence_only`; therefore changing product behavior would have weakened the authority. r2 corrects only the test expectation and explicitly checks `reasonCode: evidence_only_form`.

## Scope of r2

- Product runtime: unchanged.
- Frozen fixture and active policy: unchanged.
- `.specify`, `spec.md`, `tasks.md`, FR/NFR/AC and batch scope: unchanged.
- Test changed: `tests/unit/fundamental/filing-selection.test.ts`.
- Operational runner identity changed to `Run-FinScope-BatchValidation_B07_r2_v1.ps1` because the candidate changed.
- B07 remains `LOCAL_VALIDATION_REQUIRED`; all six B07 tasks remain `IMPLEMENTED_PENDING_VALIDATION`; B08 remains `PENDING`; convergence remains closed.

## Closure rule

The previous three PASS commands cannot be reused to promote r2. The exact r2 candidate must execute the complete 11-command sequence and return authenticated PASS evidence.
