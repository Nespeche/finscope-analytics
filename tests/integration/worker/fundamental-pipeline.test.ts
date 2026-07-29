import { describe, expect, it, vi } from 'vitest';
import { createAcquisitionPlan } from '../../../src/domain/acquisition/acquisition-plan';
import type { FundamentalAnalysisBuilderInput } from '../../../src/domain/fundamental/analysis-builder';
import type { FundamentalBundleBuilderInput } from '../../../src/domain/fundamental/bundle-builder';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
  type FundamentalBundle,
} from '../../../src/domain/fundamental/types';
import { parseCik } from '../../../src/domain/model';
import { parseOperationInstanceId } from '../../../src/types/messages';
import {
  registerFundamentalPipeline,
  type FundamentalAnalysisStageOutput,
  type FundamentalPipelineCandidate,
  type FundamentalPipelinePayload,
  type FundamentalPipelineOperationResult,
} from '../../../src/worker/fundamental-pipeline';
import {
  OperationRegistry,
  parseIssuerOperationKey,
} from '../../../src/worker/operation-registry';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';

interface Fixture {
  readonly fixtureId: string;
  readonly input: unknown;
}

const fixtureBundle = parseFundamentalBundle(
  (bundleVectorsJson as unknown as { readonly validFixtures: readonly Fixture[] }).validFixtures[0]?.input,
);
const fixtureAnalysis = parseFundamentalAnalysis(
  (analysisVectorsJson as unknown as { readonly validFixtures: readonly Fixture[] }).validFixtures
    .find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);
const issuerKey = parseIssuerOperationKey('0000320193');
const issuerCik = parseCik('0000320193');

type TestPipelinePayload = FundamentalPipelinePayload<
  { readonly source: string },
  { readonly profile: string }
>;

function plan(status: 'complete' | 'partial' = 'complete') {
  return createAcquisitionPlan({
    cik: issuerCik,
    maxExternalCalls: 14,
    requestedConceptIds: status === 'complete' ? ['revenue'] : ['revenue', 'capex'],
    cacheState: 'miss',
    companyFactsResolvedConceptIds: ['revenue'],
    eligibleFallbacks: [],
  });
}

function bundleInput(operationId: string, bundle: FundamentalBundle = fixtureBundle): FundamentalBundleBuilderInput {
  return {
    bundleId: `${bundle.bundleId}-${operationId}`,
    contractVersion: bundle.contractVersion,
    issuer: bundle.issuer,
    sourceAcquisition: {
      ...bundle.sourceAcquisition,
      operationId,
      secCallCount: 2,
      companyConceptFallbacks: [],
    },
    reportingPeriods: bundle.reportingPeriods,
    facts: bundle.facts,
    conceptResolutions: bundle.conceptResolutions,
    coverage: bundle.coverage,
    versions: bundle.versions,
    fingerprintLineage: {
      mappings: bundle.facts.map((fact) => ({
        mappingId: fact.mappingId,
        mappingVersion: fact.mappingVersion,
      })),
      currencies: bundle.reportingPeriods.flatMap((period) => (
        period.currency === undefined ? [] : [period.currency]
      )),
      units: bundle.facts.flatMap((fact) => fact.unit === undefined ? [] : [fact.unit]),
      scopes: [
        ...bundle.reportingPeriods.map((period) => period.scopeId),
        ...bundle.facts.map((fact) => fact.scopeId),
        ...bundle.conceptResolutions.map((resolution) => resolution.scopeId),
      ],
    },
    sourceEvidenceReferences: [{
      sourceKind: 'sec_company_facts',
      sourceId: `companyfacts:${issuerCik}`,
      payloadSha256: 'b'.repeat(64),
      retrievedVersion: 'integration-v1',
    }],
    ...(bundle.filings === undefined ? {} : { filings: bundle.filings }),
    ...(bundle.createdAt === undefined ? {} : { createdAt: bundle.createdAt }),
  };
}

function analysisOutput(): FundamentalAnalysisStageOutput {
  const input: FundamentalAnalysisBuilderInput = {
    analysisId: fixtureAnalysis.analysisId,
    issuerCik: fixtureAnalysis.issuerCik,
    fundamentalInputFingerprint: fixtureAnalysis.fundamentalInputFingerprint,
    metricResults: fixtureAnalysis.metricResults,
    ruleEvaluations: fixtureAnalysis.ruleEvaluations,
    versions: fixtureAnalysis.versions,
    additionalLimitations: fixtureAnalysis.synthesis.limitations ?? [],
    ...(fixtureAnalysis.createdAt === undefined ? {} : { createdAt: fixtureAnalysis.createdAt }),
  };
  const { issuerCik: _issuerCik, fundamentalInputFingerprint: _fingerprint, ...output } = input;
  return output;
}

function payload(operationIdText: string, status: 'complete' | 'partial' = 'complete'):
TestPipelinePayload {
  const operationId = parseOperationInstanceId(operationIdText);
  return {
    operationId,
    issuerCik,
    acquisition: { operationId, cik: issuerCik, plan: plan(status) },
    normalizationInput: { source: 'company_facts' },
    analysisInput: { profile: 'general_operating_us_gaap' },
  };
}

function seedPrior(
  registry: OperationRegistry<FundamentalPipelineCandidate>,
  prior: FundamentalPipelineCandidate,
): void {
  const seedId = parseOperationInstanceId('fundamental-prior-seed');
  registry.register({ issuerKey, operation: 'analyzeFundamentals', operationId: seedId });
  registry.publish(seedId, prior);
}

describe('fundamental Web Worker pipeline', () => {
  it('dispatches through the registry and publishes exactly one atomic domain candidate', async () => {
    const registry = new OperationRegistry<FundamentalPipelineCandidate>();
    const normalize = vi.fn(async ({ acquisition }: { readonly acquisition: { readonly operationId: string } }) => (
      bundleInput(acquisition.operationId)
    ));
    const analyze = vi.fn(async () => analysisOutput());
    registerFundamentalPipeline(registry, {
      acquisition: {
        runAttempt: async () => ({ status: 'success', payloadSha256: 'a'.repeat(64) }),
      },
      normalize,
      analyze,
    });
    expect(registry.hasDescriptor('analyzeFundamentals')).toBe(true);

    const request = payload('fundamental-pipeline-ready');
    const result = await registry.dispatch<TestPipelinePayload, FundamentalPipelineOperationResult>({
      issuerKey,
      operation: 'analyzeFundamentals',
      operationId: request.operationId,
    }, request);

    expect(result.status).toBe('published');
    if (result.status !== 'published') throw new Error('Expected atomic publication.');
    expect(result.result).toMatchObject({
      status: 'partial',
      acquisitionStatus: 'complete',
      candidatePublished: true,
      activePointerAction: 'replace',
    });
    expect(result.result.candidate).toBe(result.publication.result);
    expect(registry.getPublishedResult(issuerKey)).toBe(result.publication.result);
    expect(result.publication.result).toEqual({
      bundle: result.result.candidate?.bundle,
      analysis: result.result.candidate?.analysis,
    });
    expect(result.publication.result).not.toHaveProperty('status');
    expect(result.progress.map((message) => message.stage)).toEqual(expect.arrayContaining([
      'checking', 'acquiring', 'normalizing', 'analyzing', 'publishing',
    ]));
    expect(normalize).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(result.publication.result)).toBe(true);
  });

  it('publishes a usable partial candidate without a global failure', async () => {
    const registry = new OperationRegistry<FundamentalPipelineCandidate>();
    const partialBundle: FundamentalBundle = {
      ...fixtureBundle,
      facts: [],
      conceptResolutions: [{
        canonicalConceptId: 'capex',
        periodId: 'FY2025',
        scopeId: 'consolidated',
        state: 'absent',
        reasonCode: 'concept_absent',
      }],
      coverage: [{
        canonicalConceptId: 'capex',
        profileId: 'general_operating_us_gaap',
        state: 'partial',
        resolvedMappingIds: [],
        reasonCode: 'concept_absent',
      }],
    };
    registerFundamentalPipeline(registry, {
      acquisition: { runAttempt: async () => ({ status: 'success' }) },
      normalize: async ({ acquisition }) => bundleInput(acquisition.operationId, partialBundle),
      analyze: async () => ({
        ...analysisOutput(),
        metricResults: [{
          metricId: 'FND_CAPEX',
          state: 'insufficient',
          qualityClassification: 'insufficient',
          reasonCodes: ['concept_absent'],
          evidenceRefs: [],
        }],
      }),
    });

    const request = payload('fundamental-pipeline-partial', 'partial');
    const result = await registry.dispatch<TestPipelinePayload, FundamentalPipelineOperationResult>({
      issuerKey, operation: 'analyzeFundamentals', operationId: request.operationId,
    }, request);

    expect(result.status).toBe('published');
    if (result.status !== 'published') throw new Error('Expected partial publication.');
    expect(result.result.status).toBe('partial');
    expect(result.publication.result.bundle.conceptResolutions[0]).toMatchObject({
      state: 'absent', reasonCode: 'concept_absent',
    });
    expect(result.publication.result.analysis.metricResults[0]).toMatchObject({
      state: 'insufficient', reasonCodes: ['concept_absent'],
    });
  });

  it('preserves the prior atomic candidate when acquisition or normalization fails', async () => {
    const prior = Object.freeze({ bundle: fixtureBundle, analysis: fixtureAnalysis });
    const acquisitionRegistry = new OperationRegistry<FundamentalPipelineCandidate>();
    seedPrior(acquisitionRegistry, prior);
    const normalize = vi.fn(async () => bundleInput('should-not-run'));
    const analyze = vi.fn(async () => analysisOutput());
    registerFundamentalPipeline(acquisitionRegistry, {
      acquisition: { runAttempt: async () => ({ status: 'provider_error' }) },
      normalize,
      analyze,
    });

    const failedRequest = payload('fundamental-pipeline-acquisition-failed');
    const failed = await acquisitionRegistry.dispatch<TestPipelinePayload, FundamentalPipelineOperationResult>({
      issuerKey, operation: 'analyzeFundamentals', operationId: failedRequest.operationId,
    }, failedRequest);
    expect(failed.status).toBe('preserved');
    if (failed.status !== 'preserved') throw new Error('Expected preserved failed acquisition.');
    expect(failed.result).toMatchObject({
      status: 'failed', failureReason: 'acquisition_failed', activePointerAction: 'preserve',
    });
    expect(failed.priorPublishedResult).toEqual({ status: 'available', result: prior });
    expect(acquisitionRegistry.getPublishedResult(issuerKey)).toBe(prior);
    expect(normalize).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();

    const normalizationRegistry = new OperationRegistry<FundamentalPipelineCandidate>();
    seedPrior(normalizationRegistry, prior);
    registerFundamentalPipeline(normalizationRegistry, {
      acquisition: { runAttempt: async () => ({ status: 'success' }) },
      normalize: async () => { throw new Error('invalid normalized facts'); },
      analyze,
    });
    const normalizationRequest = payload('fundamental-pipeline-normalization-failed');
    const normalizationFailed = await normalizationRegistry.dispatch<TestPipelinePayload, FundamentalPipelineOperationResult>({
      issuerKey, operation: 'analyzeFundamentals', operationId: normalizationRequest.operationId,
    }, normalizationRequest);
    expect(normalizationFailed.status).toBe('preserved');
    if (normalizationFailed.status !== 'preserved') throw new Error('Expected preserved normalization failure.');
    expect(normalizationFailed.result).toMatchObject({
      status: 'failed', failureReason: 'normalization_failed', activePointerAction: 'preserve',
    });
    expect(normalizationRegistry.getPublishedResult(issuerKey)).toBe(prior);
  });

  it('cancels locally, emits no candidate and preserves the prior pointer', async () => {
    const prior = Object.freeze({ bundle: fixtureBundle, analysis: fixtureAnalysis });
    const registry = new OperationRegistry<FundamentalPipelineCandidate>();
    seedPrior(registry, prior);
    registerFundamentalPipeline(registry, {
      acquisition: {
        runAttempt: async (_attempt, signal) => new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        }),
      },
      normalize: async ({ acquisition }) => bundleInput(acquisition.operationId),
      analyze: async () => analysisOutput(),
    });

    const request = payload('fundamental-pipeline-cancelled');
    const pending = registry.dispatch<TestPipelinePayload, FundamentalPipelineOperationResult>({
      issuerKey, operation: 'analyzeFundamentals', operationId: request.operationId,
    }, request);
    await Promise.resolve();
    registry.cancel(request.operationId);
    const result = await pending;

    expect(result.status).toBe('cancelled');
    if (result.status !== 'cancelled') throw new Error('Expected cancelled pipeline.');
    expect(result.cancellation.priorPublishedResult).toEqual({ status: 'available', result: prior });
    expect(registry.getPublishedResult(issuerKey)).toBe(prior);
    expect(registry.has(request.operationId)).toBe(false);
  });
});
