import { assertDecimalString } from '../../core/decimal';
import type { Sha256Digest } from '../../core/sha256';
import { fundamentalAnalysisFingerprint } from '../fingerprints/fingerprint-service';
import type { Cik } from '../model';
import { synthesizeRuleEvaluations } from '../analytics/synthesis';
import {
  parseFundamentalAnalysis,
  type FundamentalAnalysis,
  type FundamentalMetricResult,
  type FundamentalRuleEvaluation,
} from './types';

const FORBIDDEN_PRICE_FIELDS = new Set([
  'historicalPriceOverlay',
  'historicalPriceOverlayFingerprint',
  'priceAnalysisFingerprint',
  'priceMetricResults',
  'priceQuality',
  'priceUse',
  'observations',
  'instrument',
  'overlayId',
  'overlayVersion',
]);

const FORBIDDEN_LOCAL_CLOCK_FIELDS = new Set([
  'asOfLocalDate',
  'localDate',
  'localTime',
  'localTimezone',
  'localTimestamp',
]);

export interface FundamentalAnalysisBuilderInput {
  readonly analysisId: string;
  readonly issuerCik: Cik;
  readonly fundamentalInputFingerprint: Sha256Digest;
  readonly metricResults: readonly FundamentalMetricResult[];
  readonly ruleEvaluations: readonly FundamentalRuleEvaluation[];
  readonly versions: Readonly<Record<string, string>>;
  readonly additionalLimitations?: readonly string[];
  readonly createdAt?: string;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'en');
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareText));
}

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) throw new TypeError(`EMPTY_${field.toUpperCase()}`);
}

function assertNoForbiddenFields(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (
      FORBIDDEN_PRICE_FIELDS.has(key)
      || FORBIDDEN_LOCAL_CLOCK_FIELDS.has(key)
      || key === 'fundamentalAnalysisFingerprint'
    ) {
      throw new TypeError(`FORBIDDEN_FUNDAMENTAL_ANALYSIS_FIELD:${path}.${key}`);
    }
    assertNoForbiddenFields(child, `${path}.${key}`);
  }
}

function normalizeMetrics(
  metrics: readonly FundamentalMetricResult[],
): readonly FundamentalMetricResult[] {
  const keys = new Set<string>();
  const normalized = metrics.map((metric) => {
    if (!metric.metricId.startsWith('FND_')) {
      throw new TypeError(`PRICE_OR_UNKNOWN_METRIC_IN_FUNDAMENTAL_ANALYSIS:${metric.metricId}`);
    }
    const key = `${metric.metricId}\u0000${metric.periodKey ?? ''}`;
    if (keys.has(key)) throw new TypeError(`DUPLICATE_FUNDAMENTAL_METRIC_RESULT:${key}`);
    keys.add(key);
    if (metric.valueDecimal !== undefined) assertDecimalString(metric.valueDecimal);
    return Object.freeze({
      ...metric,
      ...(metric.reasonCodes === undefined
        ? {}
        : { reasonCodes: uniqueSorted(metric.reasonCodes) }),
      ...(metric.evidenceRefs === undefined
        ? {}
        : { evidenceRefs: uniqueSorted(metric.evidenceRefs) }),
    });
  });
  return Object.freeze(normalized.sort((left, right) => compareText(left.metricId, right.metricId)
    || compareText(left.periodKey ?? '', right.periodKey ?? '')));
}

function normalizeRules(
  evaluations: readonly FundamentalRuleEvaluation[],
): readonly FundamentalRuleEvaluation[] {
  const ids = new Set<string>();
  const normalized = evaluations.map((evaluation) => {
    if (ids.has(evaluation.ruleId)) {
      throw new TypeError(`DUPLICATE_FUNDAMENTAL_RULE_EVALUATION:${evaluation.ruleId}`);
    }
    ids.add(evaluation.ruleId);
    return Object.freeze({
      ...evaluation,
      ...(evaluation.reasonCodes === undefined
        ? {}
        : { reasonCodes: uniqueSorted(evaluation.reasonCodes) }),
      ...(evaluation.evidenceRefs === undefined
        ? {}
        : { evidenceRefs: uniqueSorted(evaluation.evidenceRefs) }),
    });
  });
  return Object.freeze(normalized.sort((left, right) => compareText(left.ruleId, right.ruleId)));
}

function normalizeVersions(versions: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const entries = Object.entries(versions).sort(([left], [right]) => compareText(left, right));
  if (entries.length === 0) throw new TypeError('MISSING_FUNDAMENTAL_ANALYSIS_VERSIONS');
  for (const [key, value] of entries) {
    assertNonEmpty(key, 'analysis_version_key');
    assertNonEmpty(value, `analysis_version_${key}`);
  }
  return Object.freeze(Object.fromEntries(entries));
}

/**
 * Builds one immutable fundamental analysis candidate. Synthesis and limitations
 * are produced from completed rule outcomes; the shared fingerprint service is
 * the only producer of the analysis fingerprint.
 */
export async function buildFundamentalAnalysis(
  input: FundamentalAnalysisBuilderInput,
): Promise<FundamentalAnalysis> {
  assertNoForbiddenFields(input);
  assertNonEmpty(input.analysisId, 'analysis_id');

  const metricResults = normalizeMetrics(input.metricResults);
  const ruleEvaluations = normalizeRules(input.ruleEvaluations);
  const producedSynthesis = synthesizeRuleEvaluations(ruleEvaluations);
  const limitations = uniqueSorted([
    ...(producedSynthesis.limitations ?? []),
    ...(input.additionalLimitations ?? []),
  ].map((limitation) => {
    assertNonEmpty(limitation, 'analysis_limitation');
    return limitation;
  }));
  const synthesis = Object.freeze({
    state: producedSynthesis.state,
    triggeredRuleIds: uniqueSorted(producedSynthesis.triggeredRuleIds),
    ...(limitations.length === 0 ? {} : { limitations }),
  });
  const versions = normalizeVersions(input.versions);

  const projectionCandidate = {
    analysisKind: 'fundamental' as const,
    analysisId: input.analysisId,
    issuerCik: input.issuerCik,
    fundamentalInputFingerprint: input.fundamentalInputFingerprint,
    metricResults,
    ruleEvaluations,
    synthesis,
    versions,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  };
  const analysisFingerprint = await fundamentalAnalysisFingerprint(projectionCandidate);

  return parseFundamentalAnalysis({
    ...projectionCandidate,
    fundamentalAnalysisFingerprint: analysisFingerprint,
  });
}
