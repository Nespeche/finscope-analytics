import { canonicalJsonBytes } from '../../core/canonical-json';
import { sha256Digest, type Sha256Digest } from '../../core/sha256';
import {
  projectFingerprintInput,
  type FingerprintProjectionId,
  type SourceEvidenceReferenceInput,
} from './projections';

export interface FingerprintResult {
  readonly projectionId: FingerprintProjectionId;
  readonly fingerprint: Sha256Digest;
  readonly canonicalBytes: Uint8Array;
}

/** Computes RFC 8785 JCS UTF-8 bytes and a lowercase sha256-prefixed digest. */
export async function fingerprint(
  projectionId: FingerprintProjectionId,
  input: unknown,
): Promise<FingerprintResult> {
  const projection = projectFingerprintInput(projectionId, input);
  const canonicalBytes = canonicalJsonBytes(projection);
  const digest = await sha256Digest(canonicalBytes);
  return Object.freeze({
    projectionId,
    fingerprint: digest,
    canonicalBytes: Uint8Array.from(canonicalBytes),
  });
}

export async function fundamentalInputFingerprint(input: unknown): Promise<Sha256Digest> {
  return (await fingerprint('fundamentalInputFingerprint', input)).fingerprint;
}

export async function fundamentalAnalysisFingerprint(input: unknown): Promise<Sha256Digest> {
  return (await fingerprint('fundamentalAnalysisFingerprint', input)).fingerprint;
}

export async function historicalPriceOverlayFingerprint(input: unknown): Promise<Sha256Digest> {
  return (await fingerprint('historicalPriceOverlayFingerprint', input)).fingerprint;
}

export async function priceAnalysisFingerprint(input: unknown): Promise<Sha256Digest> {
  return (await fingerprint('priceAnalysisFingerprint', input)).fingerprint;
}

export async function sourceEvidenceFingerprint(
  evidenceReferences: readonly SourceEvidenceReferenceInput[],
): Promise<Sha256Digest> {
  return (await fingerprint('sourceEvidenceFingerprint', evidenceReferences)).fingerprint;
}
