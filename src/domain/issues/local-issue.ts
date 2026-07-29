import { createProductSchemaValidator } from '../../core/schema-validator';
import type { BlockedOperation, Capability } from '../orchestration/capabilities';
import type { PipelineState } from '../orchestration/state-machine';

const LOCAL_ISSUE_SCHEMA =
  'https://finscope.local/schemas/local-operation-issue.schema.json';

export const LOCAL_ISSUE_CODES = Object.freeze([
  'identity_ambiguous',
  'cancelled',
  'quality_gate_failed',
  'storage_consent_required',
  'invalid_fact_value',
] as const);

export type LocalIssueCode = (typeof LOCAL_ISSUE_CODES)[number];
export type LocalIssueRetryability =
  | 'after_user_action'
  | 'after_data_or_mapping_change'
  | 'after_source_change';

interface LocalOperationIssueBase<Code extends LocalIssueCode> {
  readonly kind: 'local_operation_issue';
  readonly code: Code;
  readonly message: string;
  readonly pipelineState: PipelineState;
  readonly retryability: LocalIssueRetryability;
  readonly recoveryActions: readonly string[];
  readonly preservedCapabilities: readonly Capability[];
  readonly blockedOperations: readonly BlockedOperation[];
  readonly messageKey: string;
  readonly accessibilityKey: string;
}

export type IdentityAmbiguousIssue = LocalOperationIssueBase<'identity_ambiguous'>;
export type CancelledIssue = LocalOperationIssueBase<'cancelled'>;
export type QualityGateFailedIssue = LocalOperationIssueBase<'quality_gate_failed'>;
export type StorageConsentRequiredIssue = LocalOperationIssueBase<'storage_consent_required'>;
export type InvalidFactValueIssue = LocalOperationIssueBase<'invalid_fact_value'>;

export type LocalOperationIssue =
  | IdentityAmbiguousIssue
  | CancelledIssue
  | QualityGateFailedIssue
  | StorageConsentRequiredIssue
  | InvalidFactValueIssue;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

const validator = createProductSchemaValidator();

export function parseLocalOperationIssue(input: unknown): LocalOperationIssue {
  const result = validator.validate<LocalOperationIssue>(LOCAL_ISSUE_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_LOCAL_OPERATION_ISSUE:${JSON.stringify(result.errors)}`);
  }
  return deepFreeze(structuredClone(result.value));
}

export function isLocalOperationIssue(input: unknown): input is LocalOperationIssue {
  return validator.validate<LocalOperationIssue>(LOCAL_ISSUE_SCHEMA, input).valid;
}
