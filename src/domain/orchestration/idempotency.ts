import { canonicalJsonBytes } from '../../core/canonical-json';
import { sha256Digest, type Sha256Digest } from '../../core/sha256';

export type AcquisitionType = 'open_or_resume' | 'manual_refresh' | 'incremental_reanalysis';

export interface IdempotencyKeyInput {
  readonly cik: string;
  readonly acquisitionType: AcquisitionType;
  readonly policyVersion: string;
}

export interface IdempotentCandidate<T> {
  readonly evidenceFingerprint: Sha256Digest;
  readonly value: T;
}

export interface RunIdempotentOperationInput<T> extends IdempotencyKeyInput {
  readonly idempotencyKey: Sha256Digest;
  readonly evidenceFingerprint: Sha256Digest;
  readonly createCandidate: () => Promise<T>;
}

export type IdempotentOperationResult<T> =
  | Readonly<{ status: 'started'; idempotencyKey: Sha256Digest; candidate: IdempotentCandidate<T> }>
  | Readonly<{ status: 'coalesced'; idempotencyKey: Sha256Digest; candidate: IdempotentCandidate<T> }>
  | Readonly<{ status: 'replayed'; idempotencyKey: Sha256Digest; candidate: IdempotentCandidate<T> }>;

interface InFlightEntry<T> {
  readonly idempotencyKey: Sha256Digest;
  readonly evidenceFingerprint: Sha256Digest;
  readonly promise: Promise<IdempotentCandidate<T>>;
}

export class IncompatibleIssuerOperationError extends Error {
  constructor(
    readonly cik: string,
    readonly activeAcquisitionType: AcquisitionType,
    readonly requestedAcquisitionType: AcquisitionType,
  ) {
    super(`Issuer ${cik} is busy with ${activeAcquisitionType}; cannot start ${requestedAcquisitionType}.`);
    this.name = 'IncompatibleIssuerOperationError';
  }
}

export class IdempotencyKeyMismatchError extends Error {
  constructor() {
    super('Provided idempotency key does not match CIK, acquisition type and policy version.');
    this.name = 'IdempotencyKeyMismatchError';
  }
}

function requireCik(cik: string): string {
  if (!/^\d{10}$/u.test(cik)) throw new TypeError('INVALID_IDEMPOTENCY_CIK');
  return cik;
}

function requirePolicyVersion(version: string): string {
  if (version.length === 0) throw new TypeError('EMPTY_IDEMPOTENCY_POLICY_VERSION');
  return version;
}

function lockKey(input: IdempotencyKeyInput): string {
  return `${input.cik}:${input.acquisitionType}`;
}

function evidenceKey(idempotencyKey: Sha256Digest, evidenceFingerprint: Sha256Digest): string {
  return `${idempotencyKey}:${evidenceFingerprint}`;
}

/** Derives the normative key from CIK, acquisition type and policy version only. */
export async function createIdempotencyKey(input: IdempotencyKeyInput): Promise<Sha256Digest> {
  return sha256Digest(canonicalJsonBytes({
    cik: requireCik(input.cik),
    acquisitionType: input.acquisitionType,
    policyVersion: requirePolicyVersion(input.policyVersion),
  }));
}

/**
 * Coalesces duplicate activation, rejects incompatible per-issuer work and replays the
 * already-created candidate when the same evidence is submitted again.
 */
export class IdempotentOperationCoordinator<T> {
  readonly #inFlightByLock = new Map<string, InFlightEntry<T>>();
  readonly #completedByEvidence = new Map<string, IdempotentCandidate<T>>();
  readonly #activeTypeByIssuer = new Map<string, AcquisitionType>();

  run(input: RunIdempotentOperationInput<T>): Promise<IdempotentOperationResult<T>> {
    const cik = requireCik(input.cik);
    requirePolicyVersion(input.policyVersion);

    const replay = this.#completedByEvidence.get(evidenceKey(input.idempotencyKey, input.evidenceFingerprint));
    if (replay !== undefined) {
      return Promise.resolve(Object.freeze({
        status: 'replayed' as const,
        idempotencyKey: input.idempotencyKey,
        candidate: replay,
      }));
    }

    const currentType = this.#activeTypeByIssuer.get(cik);
    if (currentType !== undefined && currentType !== input.acquisitionType) {
      return Promise.reject(new IncompatibleIssuerOperationError(cik, currentType, input.acquisitionType));
    }

    const key = lockKey(input);
    const inFlight = this.#inFlightByLock.get(key);
    if (inFlight !== undefined) {
      if (
        inFlight.idempotencyKey !== input.idempotencyKey
        || inFlight.evidenceFingerprint !== input.evidenceFingerprint
      ) {
        return Promise.reject(new IncompatibleIssuerOperationError(cik, input.acquisitionType, input.acquisitionType));
      }
      return inFlight.promise.then((candidate) => Object.freeze({
        status: 'coalesced' as const,
        idempotencyKey: input.idempotencyKey,
        candidate,
      }));
    }

    this.#activeTypeByIssuer.set(cik, input.acquisitionType);
    const candidatePromise = (async (): Promise<IdempotentCandidate<T>> => {
      const expectedKey = await createIdempotencyKey(input);
      if (expectedKey !== input.idempotencyKey) throw new IdempotencyKeyMismatchError();
      const value = await input.createCandidate();
      const candidate = Object.freeze({
        evidenceFingerprint: input.evidenceFingerprint,
        value,
      });
      this.#completedByEvidence.set(
        evidenceKey(input.idempotencyKey, input.evidenceFingerprint),
        candidate,
      );
      return candidate;
    })().finally(() => {
      this.#inFlightByLock.delete(key);
      this.#activeTypeByIssuer.delete(cik);
    });

    this.#inFlightByLock.set(key, Object.freeze({
      idempotencyKey: input.idempotencyKey,
      evidenceFingerprint: input.evidenceFingerprint,
      promise: candidatePromise,
    }));

    return candidatePromise.then((candidate) => Object.freeze({
      status: 'started' as const,
      idempotencyKey: input.idempotencyKey,
      candidate,
    }));
  }

  completedCandidateCount(): number {
    return this.#completedByEvidence.size;
  }
}
