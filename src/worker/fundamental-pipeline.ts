import { fundamentalAnalysisFingerprint } from '../domain/fingerprints/fingerprint-service';
import {
  buildFundamentalAnalysis,
  type FundamentalAnalysisBuilderInput,
} from '../domain/fundamental/analysis-builder';
import {
  buildFundamentalBundle,
  type FundamentalBundleBuilderInput,
} from '../domain/fundamental/bundle-builder';
import type {
  FundamentalAnalysis,
  FundamentalBundle,
} from '../domain/fundamental/types';
import { parseCik, type Cik } from '../domain/model';
import type { OperationInstanceId } from '../types/messages';
import {
  createAcquisitionOperationDescriptor,
  type AcquisitionCandidate,
  type AcquisitionOperationPayload,
  type AcquisitionOperationResult,
  type AcquisitionRunnerDependencies,
} from './acquisition-runner';
import {
  OperationRegistry,
  type OperationExecutionContext,
  type TypedOperationDescriptor,
} from './operation-registry';

export interface FundamentalPipelineCandidate {
  readonly bundle: FundamentalBundle;
  readonly analysis: FundamentalAnalysis;
}

export interface FundamentalNormalizationStageInput<TNormalizationInput = unknown> {
  readonly acquisition: AcquisitionOperationResult;
  readonly candidate: AcquisitionCandidate;
  readonly input: TNormalizationInput;
  readonly signal: AbortSignal;
}

export interface FundamentalAnalysisStageInput<TAnalysisInput = unknown> {
  readonly bundle: FundamentalBundle;
  readonly input: TAnalysisInput;
  readonly signal: AbortSignal;
}

export type FundamentalAnalysisStageOutput = Omit<
  FundamentalAnalysisBuilderInput,
  'issuerCik' | 'fundamentalInputFingerprint'
>;

export interface FundamentalPipelineDependencies<
  TNormalizationInput = unknown,
  TAnalysisInput = unknown,
> {
  readonly acquisition: AcquisitionRunnerDependencies;
  readonly normalize: (
    input: FundamentalNormalizationStageInput<TNormalizationInput>,
  ) => Promise<FundamentalBundleBuilderInput>;
  readonly analyze: (
    input: FundamentalAnalysisStageInput<TAnalysisInput>,
  ) => Promise<FundamentalAnalysisStageOutput>;
}

export interface FundamentalPipelinePayload<
  TNormalizationInput = unknown,
  TAnalysisInput = unknown,
> {
  readonly operationId: OperationInstanceId;
  readonly issuerCik: Cik;
  readonly acquisition: AcquisitionOperationPayload;
  readonly normalizationInput: TNormalizationInput;
  readonly analysisInput: TAnalysisInput;
}

export type FundamentalPipelineFailureReason =
  | 'acquisition_failed'
  | 'acquisition_candidate_missing'
  | 'normalization_failed'
  | 'analysis_failed'
  | 'cancelled';

export type FundamentalPipelineOperationResult = Readonly<{
  operationId: OperationInstanceId;
  issuerCik: Cik;
  status: 'ready' | 'partial' | 'failed' | 'cancelled';
  acquisitionStatus: AcquisitionOperationResult['status'];
  candidatePublished: boolean;
  activePointerAction: 'replace' | 'preserve';
  candidate?: FundamentalPipelineCandidate;
  failureReason?: FundamentalPipelineFailureReason;
}>;

function frozenCandidate(
  bundle: FundamentalBundle,
  analysis: FundamentalAnalysis,
): FundamentalPipelineCandidate {
  return Object.freeze({ bundle, analysis });
}

function preservedResult(
  payload: FundamentalPipelinePayload<unknown, unknown>,
  acquisitionStatus: AcquisitionOperationResult['status'],
  status: 'failed' | 'cancelled',
  failureReason: FundamentalPipelineFailureReason,
): FundamentalPipelineOperationResult {
  return Object.freeze({
    operationId: payload.operationId,
    issuerCik: payload.issuerCik,
    status,
    acquisitionStatus,
    candidatePublished: false,
    activePointerAction: 'preserve',
    failureReason,
  });
}

function derivePublishedStatus(
  acquisition: AcquisitionOperationResult,
  bundle: FundamentalBundle,
  analysis: FundamentalAnalysis,
): 'ready' | 'partial' {
  if (acquisition.status === 'partial') return 'partial';
  if (bundle.conceptResolutions.some((resolution) => resolution.state !== 'resolved')) return 'partial';
  if (bundle.coverage.some((coverage) => coverage.state !== 'complete')) return 'partial';
  if (analysis.metricResults.some((metric) => metric.state !== 'available')) return 'partial';
  if (analysis.ruleEvaluations.some((rule) => rule.state === 'not_evaluable')) return 'partial';
  if (analysis.synthesis.state === 'insufficient_information') return 'partial';
  return 'ready';
}

function assertPayloadIdentity(
  payload: FundamentalPipelinePayload<unknown, unknown>,
): void {
  const issuerCik = parseCik(payload.issuerCik);
  if (payload.acquisition.cik !== issuerCik) {
    throw new TypeError('FUNDAMENTAL_PIPELINE_ACQUISITION_CIK_MISMATCH');
  }
  if (payload.acquisition.operationId !== payload.operationId) {
    throw new TypeError('FUNDAMENTAL_PIPELINE_OPERATION_ID_MISMATCH');
  }
}

function cancelled(
  payload: FundamentalPipelinePayload<unknown, unknown>,
  acquisitionStatus: AcquisitionOperationResult['status'],
): FundamentalPipelineOperationResult {
  return preservedResult(payload, acquisitionStatus, 'cancelled', 'cancelled');
}

/**
 * Creates the typed Web Worker descriptor for the complete fundamental producer chain.
 * Bundle and analysis are assembled first and exposed as one atomic publication value.
 */
export function createFundamentalPipelineDescriptor<
  TNormalizationInput = unknown,
  TAnalysisInput = unknown,
>(
  dependencies: FundamentalPipelineDependencies<TNormalizationInput, TAnalysisInput>,
): TypedOperationDescriptor<
  FundamentalPipelinePayload<TNormalizationInput, TAnalysisInput>,
  FundamentalPipelineOperationResult,
  FundamentalPipelineCandidate
> {
  const acquisitionDescriptor = createAcquisitionOperationDescriptor(dependencies.acquisition);

  return Object.freeze({
    operation: 'analyzeFundamentals' as const,
    mayPublish: (result: FundamentalPipelineOperationResult) => (
      (result.status === 'ready' || result.status === 'partial')
      && result.candidate !== undefined
    ),
    toPublishedResult: (result: FundamentalPipelineOperationResult): FundamentalPipelineCandidate => {
      if (result.candidate === undefined) {
        throw new TypeError('FUNDAMENTAL_PIPELINE_CANDIDATE_NOT_AVAILABLE');
      }
      return result.candidate;
    },
    execute: async (
      payload: FundamentalPipelinePayload<TNormalizationInput, TAnalysisInput>,
      context: OperationExecutionContext,
    ): Promise<FundamentalPipelineOperationResult> => {
      assertPayloadIdentity(payload);
      if (context.signal.aborted) return cancelled(payload, 'cancelled');

      let acquisition: AcquisitionOperationResult;
      try {
        acquisition = await acquisitionDescriptor.execute(payload.acquisition, context);
      } catch (error: unknown) {
        if (context.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return cancelled(payload, 'cancelled');
        }
        return preservedResult(payload, 'failed', 'failed', 'acquisition_failed');
      }

      if (context.signal.aborted || acquisition.status === 'cancelled') {
        return cancelled(payload, acquisition.status);
      }
      if (acquisition.status === 'failed') {
        return preservedResult(payload, acquisition.status, 'failed', 'acquisition_failed');
      }
      if (acquisition.candidate === undefined) {
        return preservedResult(
          payload,
          acquisition.status,
          'failed',
          'acquisition_candidate_missing',
        );
      }

      context.reportProgress({
        stage: 'normalizing',
        completedUnits: 2,
        totalUnits: 4,
        messageKey: 'fundamental.normalizing',
      });

      let bundle: FundamentalBundle;
      try {
        const bundleInput = await dependencies.normalize({
          acquisition,
          candidate: acquisition.candidate,
          input: payload.normalizationInput,
          signal: context.signal,
        });
        if (context.signal.aborted) return cancelled(payload, acquisition.status);
        if (bundleInput.issuer.cik !== payload.issuerCik) {
          throw new TypeError('FUNDAMENTAL_PIPELINE_BUNDLE_CIK_MISMATCH');
        }
        bundle = await buildFundamentalBundle(bundleInput);
      } catch (error: unknown) {
        if (context.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return cancelled(payload, acquisition.status);
        }
        return preservedResult(payload, acquisition.status, 'failed', 'normalization_failed');
      }

      context.reportProgress({
        stage: 'analyzing',
        completedUnits: 3,
        totalUnits: 4,
        messageKey: 'fundamental.analyzing',
      });

      let analysis: FundamentalAnalysis;
      try {
        const analysisInput = await dependencies.analyze({
          bundle,
          input: payload.analysisInput,
          signal: context.signal,
        });
        if (context.signal.aborted) return cancelled(payload, acquisition.status);
        analysis = await buildFundamentalAnalysis({
          ...analysisInput,
          issuerCik: payload.issuerCik,
          fundamentalInputFingerprint: bundle.fundamentalInputFingerprint,
        });
        const verifiedFingerprint = await fundamentalAnalysisFingerprint(analysis);
        if (verifiedFingerprint !== analysis.fundamentalAnalysisFingerprint) {
          throw new TypeError('FUNDAMENTAL_ANALYSIS_FINGERPRINT_MISMATCH');
        }
      } catch (error: unknown) {
        if (context.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return cancelled(payload, acquisition.status);
        }
        return preservedResult(payload, acquisition.status, 'failed', 'analysis_failed');
      }

      const status = derivePublishedStatus(acquisition, bundle, analysis);
      const candidate = frozenCandidate(bundle, analysis);
      context.reportProgress({
        stage: 'publishing',
        completedUnits: 4,
        totalUnits: 4,
        messageKey: status === 'ready'
          ? 'fundamental.ready'
          : 'fundamental.partial',
      });
      return Object.freeze({
        operationId: payload.operationId,
        issuerCik: payload.issuerCik,
        status,
        acquisitionStatus: acquisition.status,
        candidatePublished: true,
        activePointerAction: 'replace',
        candidate,
      });
    },
  });
}

export function registerFundamentalPipeline<
  TNormalizationInput = unknown,
  TAnalysisInput = unknown,
>(
  registry: OperationRegistry<FundamentalPipelineCandidate>,
  dependencies: FundamentalPipelineDependencies<TNormalizationInput, TAnalysisInput>,
): void {
  registry.registerDescriptor(createFundamentalPipelineDescriptor(dependencies));
}
