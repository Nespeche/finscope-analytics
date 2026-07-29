import { describe, expect, it, vi } from 'vitest';
import { normalizeCik, parseCik } from '../../../src/domain/identity/cik';
import {
  resolveIssuer,
  type IssuerCandidateInput,
} from '../../../src/domain/identity/issuer-resolver';

const candidates: readonly IssuerCandidateInput[] = Object.freeze([
  Object.freeze({
    cik: 320193,
    legalName: 'Apple Inc.',
    aliases: Object.freeze(['AAPL', 'APPLE']),
    accountingStandard: 'us_gaap' as const,
    entityType: 'operating_company' as const,
    analysisProfile: 'us-gaap-industrial-v1',
  }),
  Object.freeze({
    cik: '0001652044',
    legalName: 'Alphabet Inc.',
    aliases: Object.freeze(['GOOG', 'GOOGL', 'ALPHA']),
    analysisProfile: 'us-gaap-industrial-v1',
  }),
  Object.freeze({
    cik: '0001855612',
    legalName: 'Alpha Example Holdings Inc.',
    aliases: Object.freeze(['ALPHA']),
    analysisProfile: 'us-gaap-industrial-v1',
  }),
]);

describe('CIK and issuer resolution', () => {
  it('normalizes numeric aliases but requires canonical CIK at domain boundaries', () => {
    expect(normalizeCik(320193)).toBe('0000320193');
    expect(normalizeCik('320193')).toBe('0000320193');
    expect(parseCik('0000320193')).toBe('0000320193');
    expect(() => parseCik('320193')).toThrow(/INVALID_CIK/u);
    expect(() => normalizeCik('32O193')).toThrow(/INVALID_CIK/u);
  });

  it('resolves one ticker alias to a zero-padded authoritative CIK', () => {
    const result = resolveIssuer('aapl', candidates);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') throw new Error('Expected one issuer.');
    expect(result.issuer).toEqual({
      cik: '0000320193',
      legalName: 'Apple Inc.',
      accountingStandard: 'us_gaap',
      entityType: 'operating_company',
      analysisProfile: 'us-gaap-industrial-v1',
    });
    expect(result.issuer).not.toHaveProperty('aliases');
  });

  it('stops an ambiguous alias locally before any network call', () => {
    const network = vi.fn();
    vi.stubGlobal('fetch', network);

    const result = resolveIssuer('ALPHA', candidates);

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') throw new Error('Expected ambiguity.');
    expect(result.issue).toMatchObject({
      kind: 'local_operation_issue',
      code: 'identity_ambiguous',
      pipelineState: 'failed',
      recoveryActions: ['select_issuer_by_cik'],
      preservedCapabilities: ['definitions', 'evidence'],
    });
    expect(result.candidates.map((candidate) => candidate.cik)).toEqual([
      '0001652044',
      '0001855612',
    ]);
    expect(network).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('resolves a direct CIK independently of ticker aliases', () => {
    const result = resolveIssuer('0001652044', candidates);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') throw new Error('Expected one issuer.');
    expect(result.issuer.legalName).toBe('Alphabet Inc.');
  });
});
