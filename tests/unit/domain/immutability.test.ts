import { describe, expect, it } from 'vitest';
import analysisVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import fundamentalVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import priceVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/price/historical-price-overlay-test-vectors.json';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
} from '../../../src/domain/fundamental/types';
import { cloneAndFreezeDomainRecord, parseCik } from '../../../src/domain/model';
import {
  parseHistoricalPriceOverlay,
  parsePriceAnalysis,
} from '../../../src/domain/price/types';

describe('immutable and separated domain records', () => {
  it('validates and deeply freezes the authoritative fundamental bundle', () => {
    const fixture = fundamentalVectors.validFixtures[0];
    expect(fixture).toBeDefined();
    const bundle = parseFundamentalBundle(fixture?.input);

    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.issuer)).toBe(true);
    expect(Object.isFrozen(bundle.facts)).toBe(true);
    expect(Object.isFrozen(bundle.facts[0])).toBe(true);
    expect(bundle).not.toHaveProperty('historicalPriceOverlay');
    expect(bundle).not.toHaveProperty('historicalPriceOverlayFingerprint');
    expect(() => {
      (bundle as { bundleId: string }).bundleId = 'mutated';
    }).toThrow(TypeError);
  });

  it('rejects price contamination in fundamental bundles and analyses', () => {
    const contaminatedBundle = fundamentalVectors.negativeFixtures.find(
      (fixture) => fixture.fixtureId === 'FUND-BUNDLE-PRICE-CONTAMINATION',
    );
    const contaminatedAnalysis = analysisVectors.negativeFixtures.find(
      (fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-WITH-PRICE',
    );

    expect(() => parseFundamentalBundle(contaminatedBundle?.input))
      .toThrow(/INVALID_FUNDAMENTAL_BUNDLE/u);
    expect(() => parseFundamentalAnalysis(contaminatedAnalysis?.input))
      .toThrow(/INVALID_FUNDAMENTAL_ANALYSIS/u);
  });

  it('validates and freezes fundamental and price analyses independently', () => {
    const fundamentalFixture = analysisVectors.validFixtures.find(
      (fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID',
    );
    const priceFixture = analysisVectors.validFixtures.find(
      (fixture) => fixture.fixtureId === 'ANALYSIS-PRICE-VALID',
    );

    const fundamental = parseFundamentalAnalysis(fundamentalFixture?.input);
    const price = parsePriceAnalysis(priceFixture?.input);

    expect(fundamental.analysisKind).toBe('fundamental');
    expect(fundamental).not.toHaveProperty('priceAnalysisFingerprint');
    expect(price.analysisKind).toBe('historical_price_descriptive');
    expect(price).not.toHaveProperty('fundamentalAnalysisFingerprint');
    expect(Object.isFrozen(fundamental.metricResults)).toBe(true);
    expect(Object.isFrozen(price.priceMetricResults)).toBe(true);
  });

  it('keeps historical price overlay versions immutable and free of fundamental fields', () => {
    const fixture = priceVectors.fixtures.find(
      (candidate) => candidate.fixtureId === 'PRICE-OVERLAY-VALID',
    );
    const overlay = parseHistoricalPriceOverlay(fixture?.input);

    expect(overlay.overlayVersion).toBe(1);
    expect(overlay.priceUse).toBe('historical_descriptive_only');
    expect(overlay).not.toHaveProperty('fundamentalInputFingerprint');
    expect(overlay).not.toHaveProperty('metricResults');
    expect(Object.isFrozen(overlay.observations)).toBe(true);
    expect(Object.isFrozen(overlay.observations[0])).toBe(true);
  });

  it('validates CIK identity and recursively freezes arbitrary domain records', () => {
    expect(parseCik('0000320193')).toBe('0000320193');
    expect(() => parseCik('AAPL')).toThrow(/ten ASCII digits/u);

    const record = cloneAndFreezeDomainRecord({ nested: { values: [1, 2, 3] } });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.nested)).toBe(true);
    expect(Object.isFrozen(record.nested.values)).toBe(true);
  });
});
