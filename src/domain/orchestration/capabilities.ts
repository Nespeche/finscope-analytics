export const CAPABILITIES = Object.freeze([
  'issuer_identity',
  'filings',
  'fundamentals',
  'insights',
  'local_snapshot',
  'price_import',
  'price_descriptive',
  'evidence',
  'definitions',
  'mappings',
] as const);

export const BLOCKED_OPERATIONS = Object.freeze([
  'requested_operation',
  'requested_resource',
  'acquisition',
  'normalization',
  'persistence',
  'active_operation',
] as const);

export type Capability = (typeof CAPABILITIES)[number];
export type BlockedOperation = (typeof BLOCKED_OPERATIONS)[number];

export interface CapabilityDisposition {
  readonly preservedCapabilities: readonly Capability[];
  readonly blockedCapabilities?: readonly Capability[];
  readonly blockedOperations: readonly BlockedOperation[];
}

function duplicates<T extends string>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Object.freeze([...repeated]);
}

export function assertCapabilityDisposition(
  disposition: CapabilityDisposition,
): asserts disposition is CapabilityDisposition {
  const preservedDuplicates = duplicates(disposition.preservedCapabilities);
  const blockedDuplicates = duplicates(disposition.blockedCapabilities ?? []);
  const operationDuplicates = duplicates(disposition.blockedOperations);
  if (preservedDuplicates.length > 0 || blockedDuplicates.length > 0 || operationDuplicates.length > 0) {
    throw new Error('CAPABILITY_DISPOSITION_CONTAINS_DUPLICATES');
  }

  const preserved = new Set(disposition.preservedCapabilities);
  const overlap = (disposition.blockedCapabilities ?? []).filter((capability) => preserved.has(capability));
  if (overlap.length > 0) {
    throw new Error(`CAPABILITY_DISPOSITION_OVERLAP:${overlap.join(',')}`);
  }
}

export function isCapabilityPreserved(
  disposition: CapabilityDisposition,
  capability: Capability,
): boolean {
  assertCapabilityDisposition(disposition);
  return disposition.preservedCapabilities.includes(capability);
}

export function isCapabilityBlocked(
  disposition: CapabilityDisposition,
  capability: Capability,
): boolean {
  assertCapabilityDisposition(disposition);
  return disposition.blockedCapabilities?.includes(capability) ?? false;
}

export function isOperationBlocked(
  disposition: CapabilityDisposition,
  operation: BlockedOperation,
): boolean {
  assertCapabilityDisposition(disposition);
  return disposition.blockedOperations.includes(operation);
}
