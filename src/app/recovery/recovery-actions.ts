import gatewayProblemCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/gateway-problem-details-catalog.json';
import localIssueCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/local-operation-issue-catalog.json';

export interface RecoveryIssueDescriptor {
  readonly code: string;
  readonly source: 'gateway' | 'local' | 'repository';
  readonly title: string;
  readonly message: string;
  readonly pipelineState: string;
  readonly blockedOperations: readonly string[];
  readonly preservedCapabilities: readonly string[];
  readonly recoveryActions: readonly string[];
  readonly resourceType?: string;
}

export interface RecoveryOperation {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly routeLabel: string;
  readonly targetSelector?: string;
  readonly eventName?: string;
}

interface CatalogIssue {
  readonly code: string;
  readonly blockedOperations: readonly string[];
  readonly preservedCapabilities: readonly string[];
  readonly recoveryActions: readonly string[];
  readonly pipelineState?: string;
  readonly operationState?: string;
  readonly resourceType?: string;
}

interface GatewayCatalog {
  readonly variants: readonly CatalogIssue[];
  readonly resourceNotFoundVariants: readonly CatalogIssue[];
}

interface LocalCatalog {
  readonly issues: readonly CatalogIssue[];
}

const gatewayCatalog = gatewayProblemCatalogJson as GatewayCatalog;
const localCatalog = localIssueCatalogJson as LocalCatalog;

const operationDefinitions = Object.freeze({
  choose_existing_resource: {
    id: 'choose_existing_resource',
    label: 'Choose an existing resource',
    description: 'Return to issuer search and select an available authoritative resource.',
    routeLabel: 'Issuer search',
    targetSelector: '#issuer-query',
  },
  continue_with_compatible_metrics: {
    id: 'continue_with_compatible_metrics',
    label: 'Continue with compatible metrics',
    description: 'Open the fundamental metrics view while unavailable inputs remain explicitly unavailable.',
    routeLabel: 'Fundamental metrics',
  },
  continue_without_persistence: {
    id: 'continue_without_persistence',
    label: 'Continue without persistence',
    description: 'Continue analysis in memory without writing personal data to IndexedDB.',
    routeLabel: 'Privacy settings',
    targetSelector: 'main button',
    eventName: 'finscope:continue-without-persistence',
  },
  correct_input: {
    id: 'correct_input',
    label: 'Correct the input',
    description: 'Return to the relevant input and correct the invalid value before retrying.',
    routeLabel: 'Issuer search',
    targetSelector: '#issuer-query',
  },
  narrow_request: {
    id: 'narrow_request',
    label: 'Narrow the request',
    description: 'Return to SEC acquisition and request one authoritative issuer context at a time.',
    routeLabel: 'SEC acquisition',
    targetSelector: '#acquisition-cik',
  },
  request_storage_consent: {
    id: 'request_storage_consent',
    label: 'Review storage consent',
    description: 'Open privacy settings and explicitly grant or decline local persistence.',
    routeLabel: 'Privacy settings',
    targetSelector: 'input[type="checkbox"]',
  },
  restart: {
    id: 'restart',
    label: 'Restart the operation',
    description: 'Restart the interrupted operation from its active user interface.',
    routeLabel: 'Home',
    targetSelector: '[data-testid="refresh-fundamentals-button"]',
    eventName: 'finscope:restart-operation',
  },
  retry: {
    id: 'retry',
    label: 'Retry the operation',
    description: 'Retry through the SEC acquisition interface while preserving the active snapshot.',
    routeLabel: 'SEC acquisition',
    targetSelector: 'main button',
    eventName: 'finscope:retry-operation',
  },
  review_limitations: {
    id: 'review_limitations',
    label: 'Review limitations',
    description: 'Review the current descriptive limitations before deciding whether to retry.',
    routeLabel: 'Insights',
    targetSelector: '[aria-labelledby="synthesis-heading"]',
  },
  review_policy: {
    id: 'review_policy',
    label: 'Review access policy',
    description: 'Review consent and fair-access controls before another external request.',
    routeLabel: 'Privacy settings',
  },
  review_source_fact: {
    id: 'review_source_fact',
    label: 'Review the source fact',
    description: 'Inspect raw SEC fact lineage and the normalization outcome.',
    routeLabel: 'Facts',
    targetSelector: '[data-fact-state="unavailable"], [data-fact-state="normalized"]',
  },
  select_issuer_by_cik: {
    id: 'select_issuer_by_cik',
    label: 'Select issuer by CIK',
    description: 'Choose one authoritative zero-padded CIK; ticker aliases never resolve silently.',
    routeLabel: 'Issuer search',
    targetSelector: '#candidate-heading, #issuer-query',
  },
  use_cached_sec_payload: {
    id: 'use_cached_sec_payload',
    label: 'Use cached SEC data',
    description: 'Continue from the last validated SEC payload without replacing the active snapshot.',
    routeLabel: 'SEC acquisition',
    eventName: 'finscope:use-cached-sec-payload',
  },
  use_last_snapshot: {
    id: 'use_last_snapshot',
    label: 'Use last snapshot',
    description: 'Keep the last schema-valid active snapshot and pointer.',
    routeLabel: 'Home',
    targetSelector: '[aria-label="Refresh recovery actions"] button:last-child',
    eventName: 'finscope:use-last-snapshot',
  },
  validate_restore: {
    id: 'validate_restore',
    label: 'Validate a restore file',
    description: 'Open data management and preview a restore package before any local write.',
    routeLabel: 'Data management',
    targetSelector: 'input[type="file"]',
  },
  check_integrity: {
    id: 'check_integrity',
    label: 'Check local data integrity',
    description: 'Re-run schema and referential-integrity checks against active local records.',
    routeLabel: 'Data management',
    targetSelector: 'main .actions button',
  },
  delete_corrupt_data: {
    id: 'delete_corrupt_data',
    label: 'Delete corrupted local data',
    description: 'Use the confirmed local deletion flow after preserving any recoverable backup.',
    routeLabel: 'Data management',
    targetSelector: 'main .destructive button',
  },
} as const satisfies Readonly<Record<string, RecoveryOperation>>);

function humanize(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function fromCatalog(issue: CatalogIssue, source: 'gateway' | 'local'): RecoveryIssueDescriptor {
  const resourceSuffix = issue.resourceType === undefined ? '' : ` (${issue.resourceType})`;
  return Object.freeze({
    code: issue.resourceType === undefined ? issue.code : `${issue.code}:${issue.resourceType}`,
    source,
    title: `${humanize(issue.code)}${resourceSuffix}`,
    message: `${humanize(issue.code)} requires an explicit recovery action.`,
    pipelineState: issue.pipelineState ?? issue.operationState ?? 'failed',
    blockedOperations: Object.freeze([...issue.blockedOperations]),
    preservedCapabilities: Object.freeze([...issue.preservedCapabilities]),
    recoveryActions: Object.freeze([...issue.recoveryActions]),
    ...(issue.resourceType === undefined ? {} : { resourceType: issue.resourceType }),
  });
}

const catalogIssues = [
  ...localCatalog.issues.map((issue) => fromCatalog(issue, 'local')),
  ...gatewayCatalog.variants.map((issue) => fromCatalog(issue, 'gateway')),
  ...gatewayCatalog.resourceNotFoundVariants.map((issue) => fromCatalog(issue, 'gateway')),
] as const;

export const repositoryCorruptionIssue: RecoveryIssueDescriptor = Object.freeze({
  code: 'repository_corruption',
  source: 'repository',
  title: 'Local repository corruption',
  message: 'Corrupted records are quarantined and excluded from active data and exports.',
  pipelineState: 'partial',
  blockedOperations: Object.freeze(['corrupted_record_activation']),
  preservedCapabilities: Object.freeze([
    'issuer_identity',
    'local_snapshot',
    'definitions',
    'mappings',
    'evidence',
    'export_restore',
  ]),
  recoveryActions: Object.freeze(['check_integrity', 'validate_restore', 'delete_corrupt_data']),
});

export const recoveryIssues: readonly RecoveryIssueDescriptor[] = Object.freeze([
  ...catalogIssues,
  repositoryCorruptionIssue,
]);

const issueByCode = new Map<string, RecoveryIssueDescriptor>();
for (const issue of recoveryIssues) {
  issueByCode.set(issue.code, issue);
  if (issue.resourceType === undefined && !issueByCode.has(issue.code.split(':')[0] ?? issue.code)) {
    issueByCode.set(issue.code.split(':')[0] ?? issue.code, issue);
  }
}

export const recoveryOperations: Readonly<Record<string, RecoveryOperation>> = operationDefinitions;

export function listUnmappedRecoveryActions(): readonly string[] {
  const actions = new Set(recoveryIssues.flatMap((issue) => [...issue.recoveryActions]));
  return Object.freeze(
    [...actions]
      .filter((actionId) => recoveryOperations[actionId] === undefined)
      .sort((left, right) => left.localeCompare(right, 'en')),
  );
}

export function getRecoveryOperation(actionId: string): RecoveryOperation {
  const operation = recoveryOperations[actionId];
  if (operation === undefined) {
    throw new Error(`No active recovery operation is registered for ${actionId}.`);
  }
  return operation;
}

export function getRecoveryIssue(code: string): RecoveryIssueDescriptor | undefined {
  return issueByCode.get(code);
}

export function parseRecoveryIssueDetail(value: unknown): RecoveryIssueDescriptor | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  if (typeof record.code !== 'string' || record.code.trim().length === 0) return undefined;
  const catalogIssue = getRecoveryIssue(record.code);
  if (catalogIssue === undefined) return undefined;
  const message = typeof record.message === 'string' && record.message.trim().length > 0
    ? record.message.trim()
    : catalogIssue.message;
  return Object.freeze({ ...catalogIssue, message });
}

export function issueCodeFromText(text: string): string | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes('more than one issuer') || normalized.includes('ambiguous')) return 'identity_ambiguous';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('consent') && normalized.includes('storage')) return 'storage_consent_required';
  if (normalized.includes('quality') && normalized.includes('fail')) return 'quality_gate_failed';
  if (normalized.includes('invalid') && normalized.includes('fact')) return 'invalid_fact_value';
  if (normalized.includes('payload') && normalized.includes('large')) return 'payload_too_lare';
  if (normalized.includes('policy') && normalized.includes('block')) return 'blocked_by_policy';
  if (normalized.includes('timeout')) return 'upstream_timeout';
  if (normalized.includes('provider') && normalized.includes('unavailable')) return 'provider_unavailable';
  if (normalized.includes('invalid payload')) return 'invalid_payload';
  if (normalized.includes('not found') || normalized.includes('no issuer matched')) return 'resource_not_found:issuer';
  if (normalized.includes('invalid request')) return 'invalid_request';
  return undefined;
}
