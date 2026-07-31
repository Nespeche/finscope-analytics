import { describe, expect, it, vi } from 'vitest';
import type { Sha256Digest } from '../../../src/core/sha256';
import {
  createIdempotencyKey,
  IdempotentOperationCoordinator,
  IncompatibleIssuerOperationError,
} from '../../../src/domain/orchestration/idempotency';

const cik = '0000320193';
const policyVersion = '5.0.1';
const evidenceFingerprint = `sha256:${'c'.repeat(64)}` as Sha256Digest;

describe('refresh idempotency coordinator', () => {
  it('coalesces double activation into one operation and one candidate', async () => {
    const coordinator = new IdempotentOperationCoordinator<Readonly<{ snapshotId: string }>>();
    const idempotencyKey = await createIdempotencyKey({
      cik,
      acquisitionType: 'manual_refresh',
      policyVersion,
    });
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const createCandidate = vi.fn(async () => {
      await gate;
      return Object.freeze({ snapshotId: 'snapshot-B' });
    });
    const input = {
      cik,
      acquisitionType: 'manual_refresh' as const,
      policyVersion,
      idempotencyKey,
      evidenceFingerprint,
      createCandidate,
    };

    const first = coordinator.run(input);
    const second = coordinator.run(input);
    await Promise.resolve();
    release?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(createCandidate).toHaveBeenCalledTimes(1);
    expect([firstResult.status, secondResult.status].sort()).toEqual(['coalesced', 'started']);
    expect(firstResult.candidate).toBe(secondResult.candidate);
    expect(firstResult.candidate.value).toEqual({ snapshotId: 'snapshot-B' });
    expect(coordinator.completedCandidateCount()).toBe(1);
  });

  it('replays identical evidence without another snapshot or commit candidate', async () => {
    const coordinator = new IdempotentOperationCoordinator<string>();
    const idempotencyKey = await createIdempotencyKey({ cik, acquisitionType: 'open_or_resume', policyVersion });
    const createCandidate = vi.fn().mockResolvedValue('snapshot-A');
    const input = {
      cik,
      acquisitionType: 'open_or_resume' as const,
      policyVersion,
      idempotencyKey,
      evidenceFingerprint,
      createCandidate,
    };
    const first = await coordinator.run(input);
    const replay = await coordinator.run(input);
    expect(first.status).toBe('started');
    expect(replay.status).toBe('replayed');
    expect(replay.candidate).toBe(first.candidate);
    expect(createCandidate).toHaveBeenCalledTimes(1);
  });

  it('rejects incompatible concurrent acquisition types for one issuer', async () => {
    const coordinator = new IdempotentOperationCoordinator<string>();
    const manualKey = await createIdempotencyKey({ cik, acquisitionType: 'manual_refresh', policyVersion });
    const openKey = await createIdempotencyKey({ cik, acquisitionType: 'open_or_resume', policyVersion });
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const active = coordinator.run({
      cik,
      acquisitionType: 'manual_refresh',
      policyVersion,
      idempotencyKey: manualKey,
      evidenceFingerprint,
      createCandidate: async () => { await gate; return 'candidate'; },
    });
    await Promise.resolve();
    await expect(coordinator.run({
      cik,
      acquisitionType: 'open_or_resume',
      policyVersion,
      idempotencyKey: openKey,
      evidenceFingerprint,
      createCandidate: async () => 'incompatible',
    })).rejects.toBeInstanceOf(IncompatibleIssuerOperationError);
    release?.();
    await active;
  });
});
