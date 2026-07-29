import { describe, expect, it } from 'vitest';
import selectionVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-selection-test-vectors.json';
import {
  selectFilingFact,
  type SecFactCandidate,
} from '../../../src/domain/fundamental/filing-selection';

function candidate(overrides: Partial<SecFactCandidate> = {}): SecFactCandidate {
  return {
    factId: 'fact-revenue-2025',
    canonicalConceptId: 'revenue',
    taxonomy: 'us-gaap',
    tag: 'RevenueFromContractWithCustomerExcludingAssessedTax',
    unit: 'USD',
    start: '2025-01-01',
    end: '2025-12-31',
    scope: 'consolidated',
    source: 'company_facts',
    form: '10-K',
    filed: '2026-01-30',
    accessionNumber: '0000320193-26-000001',
    value: '10.000000000000',
    mappingStatus: 'ACTIVE',
    mappingQuality: 'exact',
    mappingVersion: '5.0.0',
    profileCompatible: true,
    scopeCompatible: true,
    ...overrides,
  };
}

describe('SEC filing fact selection', () => {
  it('covers every frozen selection vector and keeps 8-K/frame values evidence-only', () => {
    expect(selectionVectors.vectors).toHaveLength(10);
    expect(selectionVectors.vectors.map((vector) => vector.vectorId)).toEqual([
      'company-facts-primary',
      'company-concept-exact-fallback',
      '8k-evidence-only',
      'exact-duplicate-collapse',
      'amendment-specific-replacement',
      'amendment-absence-does-not-delete',
      'later-restatement',
      'equal-precedence-conflict',
      'frame-ignored-for-selection',
      'unit-conflict',
    ]);

    const eightK = selectFilingFact([candidate({ form: '8-K' })]);
    expect(eightK).toMatchObject({ state: 'evidence_only', reasonCode: 'evidence_only_form' });

    const frame = selectFilingFact([candidate({ frame: 'CY2025' })]);
    expect(frame).toMatchObject({ state: 'evidence_only', reasonCode: 'evidence_only_form' });
    expect(frame.evidence).toHaveLength(1);
  });

  it('collapses exact duplicates while preserving every exact source reference', () => {
    const result = selectFilingFact([
      candidate({ accessionNumber: 'A' }),
      candidate({ accessionNumber: 'B' }),
    ]);

    expect(result.state).toBe('selected');
    if (result.state !== 'selected') throw new Error('Expected selected result.');
    expect(result.fact.value).toBe('10.000000000000');
    expect(result.fact.sourceRefs.map((sourceRef) => sourceRef.accessionNumber)).toEqual(['A', 'B']);
    expect(result.fact.reasonCodes).toContain('exact_duplicate_collapsed');
  });

  it('lets an amendment replace only a fact it contains and retains original lineage', () => {
    const original = candidate({
      form: '10-Q',
      filed: '2025-10-30',
      accessionNumber: 'ORIGINAL',
      value: '10.000000000000',
    });
    const amendment = candidate({
      form: '10-Q/A',
      filed: '2025-11-15',
      accessionNumber: 'AMENDMENT',
      value: '11.000000000000',
      containsConcept: true,
    });

    const replacement = selectFilingFact([original, amendment]);
    expect(replacement.state).toBe('selected');
    if (replacement.state !== 'selected') throw new Error('Expected selected replacement.');
    expect(replacement.fact.value).toBe('11.000000000000');
    expect(replacement.fact.lineageSourceRefs.map((sourceRef) => sourceRef.accessionNumber)).toEqual([
      'AMENDMENT', 'ORIGINAL',
    ]);
    expect(replacement.fact.reasonCodes).toContain('amendment_precedence');
    expect(replacement.fact.reasonCodes).toContain('restatement_precedence');

    const absent = selectFilingFact([original, { ...amendment, containsConcept: false }]);
    expect(absent.state).toBe('selected');
    if (absent.state !== 'selected') throw new Error('Expected original fact.');
    expect(absent.fact.value).toBe('10.000000000000');
  });

  it('fails closed for equal-precedence conflicts and incompatible units', () => {
    const conflict = selectFilingFact([
      candidate({ accessionNumber: 'A', value: '10.000000000000' }),
      candidate({ accessionNumber: 'B', value: '11.000000000000' }),
    ]);
    expect(conflict).toMatchObject({ state: 'ambiguous', reasonCode: 'conflicting_equal_precedence' });

    const unitConflict = selectFilingFact([
      candidate({ unit: 'USD' }),
      candidate({ unit: 'EUR', accessionNumber: 'B', value: '9.000000000000' }),
    ]);
    expect(unitConflict).toMatchObject({ state: 'incompatible', reasonCode: 'unit_incompatible' });
  });
});
