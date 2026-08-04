import { describe, expect, it } from 'vitest';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';

describe('remediation validation allowlist integrity', () => {
  it('requires every closure output path to be covered by the parent remediation allowlist', () => {
    for (const remediation of (handoffDocument as any).remediations) {
      if (!remediation.closurePolicy) continue;
      const validationPaths = new Set<string>(remediation.allowedPaths);
      const missing = remediation.closurePolicy.allowedPaths.filter(
        (path: string) => !validationPaths.has(path),
      );
      expect({ remediationId: remediation.id, missing }).toEqual({
        remediationId: remediation.id,
        missing: [],
      });
    }
  });

  it('keeps the B21 recovery remediation in candidate stage until exact-head PASS evidence exists', () => {
    const remediation = (handoffDocument as any).remediations.find(
      (entry: any) => entry.id === 'b21-final-release-promotion-remediation',
    );
    expect(remediation).toBeDefined();
    expect(remediation.closurePolicy).toMatchObject({
      stage: 'candidate',
      status: 'NOT_REQUESTED',
      candidate: null,
      closure: null,
    });
    expect(remediation.allowedPaths).toEqual(
      expect.arrayContaining(remediation.closurePolicy.allowedPaths),
    );
    expect((handoffDocument as any).release.pending).toBe(true);
    expect((handoffDocument as any).productState).toMatchObject({
      activeBatchId: 'B22',
      nextAuthorizedBatchId: 'B22',
      convergenceAuthorized: false,
    });
  });
});
