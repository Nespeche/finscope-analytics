import acceptanceCriteriaCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/acceptance-criteria-catalog.schema.json';
import accountingProfileCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/accounting-profile-catalog.schema.json';
import analysisResultsSchema from '../../specs/001-fundamental-analysis-platform/schemas/analysis-results.schema.json';
import cacheAndRefreshPolicySchema from '../../specs/001-fundamental-analysis-platform/schemas/cache-and-refresh-policy.schema.json';
import cloudflareFreeBudgetSchema from '../../specs/001-fundamental-analysis-platform/schemas/cloudflare-free-budget.schema.json';
import commonSchema from '../../specs/001-fundamental-analysis-platform/schemas/common.schema.json';
import fingerprintProjectionsSchema from '../../specs/001-fundamental-analysis-platform/schemas/fingerprint-projections.schema.json';
import formulaCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/formula-catalog.schema.json';
import formulaVectorsSchema from '../../specs/001-fundamental-analysis-platform/schemas/formula-vectors.schema.json';
import fundamentalBundleSchema from '../../specs/001-fundamental-analysis-platform/schemas/fundamental-bundle.schema.json';
import historicalPriceOverlaySchema from '../../specs/001-fundamental-analysis-platform/schemas/historical-price-overlay.schema.json';
import insightRuleCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/insight-rule-catalog.schema.json';
import localExportRestoreContractSchema from '../../specs/001-fundamental-analysis-platform/schemas/local-export-restore-contract.schema.json';
import localOperationIssueSchema from '../../specs/001-fundamental-analysis-platform/schemas/local-operation-issue.schema.json';
import metricCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/metric-catalog.schema.json';
import problemDetailsSchema from '../../specs/001-fundamental-analysis-platform/schemas/problem-details.schema.json';
import qualityModelCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/quality-model-catalog.schema.json';
import requirementsAcceptanceTraceabilitySchema from '../../specs/001-fundamental-analysis-platform/schemas/requirements-acceptance-traceability.schema.json';
import ruleNodeSchema from '../../specs/001-fundamental-analysis-platform/schemas/rule-node.schema.json';
import secAcquisitionSchema from '../../specs/001-fundamental-analysis-platform/schemas/sec-acquisition.schema.json';
import secFilingFactSelectionPolicySchema from '../../specs/001-fundamental-analysis-platform/schemas/sec-filing-fact-selection-policy.schema.json';
import securityAndInputLimitsSchema from '../../specs/001-fundamental-analysis-platform/schemas/security-and-input-limits.schema.json';
import stateAndCapabilityCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/state-and-capability-catalog.schema.json';
import storageRecordsSchema from '../../specs/001-fundamental-analysis-platform/schemas/storage-records.schema.json';
import wcag22AaMatrixSchema from '../../specs/001-fundamental-analysis-platform/schemas/wcag-2.2-aa-matrix.schema.json';
import xbrlMappingCatalogSchema from '../../specs/001-fundamental-analysis-platform/schemas/xbrl-mapping-catalog.schema.json';

export interface ProductSchemaDocument extends Readonly<Record<string, unknown>> {
  readonly $id: string;
  readonly $schema?: string;
}

const importedProductSchemas: readonly unknown[] = [
  acceptanceCriteriaCatalogSchema,
  accountingProfileCatalogSchema,
  analysisResultsSchema,
  cacheAndRefreshPolicySchema,
  cloudflareFreeBudgetSchema,
  commonSchema,
  fingerprintProjectionsSchema,
  formulaCatalogSchema,
  formulaVectorsSchema,
  fundamentalBundleSchema,
  historicalPriceOverlaySchema,
  insightRuleCatalogSchema,
  localExportRestoreContractSchema,
  localOperationIssueSchema,
  metricCatalogSchema,
  problemDetailsSchema,
  qualityModelCatalogSchema,
  requirementsAcceptanceTraceabilitySchema,
  ruleNodeSchema,
  secAcquisitionSchema,
  secFilingFactSelectionPolicySchema,
  securityAndInputLimitsSchema,
  stateAndCapabilityCatalogSchema,
  storageRecordsSchema,
  wcag22AaMatrixSchema,
  xbrlMappingCatalogSchema,
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSchemaDocument(value: unknown, index: number): asserts value is ProductSchemaDocument {
  if (!isRecord(value)) {
    throw new TypeError(`Product schema at import index ${index} is not a JSON object.`);
  }
  if (typeof value.$id !== 'string' || value.$id.trim().length === 0) {
    throw new Error(`Product schema at import index ${index} has no non-empty $id.`);
  }
  let parsedId: URL;
  try {
    parsedId = new URL(value.$id);
  } catch {
    throw new Error(`Product schema at import index ${index} has a non-absolute $id: ${value.$id}`);
  }
  if (parsedId.hash.length > 0) {
    throw new Error(`Product schema $id must not include a fragment: ${value.$id}`);
  }
}

function collectSchemaReferences(value: unknown, references: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaReferences(item, references);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if ('$ref' in value) {
    if (typeof value.$ref !== 'string' || value.$ref.length === 0) {
      throw new Error('Every $ref in an active product schema must be a non-empty string.');
    }
    references.push(value.$ref);
  }
  for (const child of Object.values(value)) {
    collectSchemaReferences(child, references);
  }
}

function referenceDocumentId(reference: string, schemaId: string): string {
  const resolved = new URL(reference, schemaId);
  resolved.hash = '';
  return resolved.href;
}

export function createProductSchemaRegistry(
  candidates: readonly unknown[] = importedProductSchemas,
): readonly ProductSchemaDocument[] {
  const schemas = candidates.map((candidate, index) => {
    assertSchemaDocument(candidate, index);
    return candidate;
  }).sort((left, right) => left.$id.localeCompare(right.$id, 'en'));

  const ids = new Set<string>();
  for (const schema of schemas) {
    if (ids.has(schema.$id)) {
      throw new Error(`Duplicate product schema $id: ${schema.$id}`);
    }
    ids.add(schema.$id);
  }

  for (const schema of schemas) {
    const references: string[] = [];
    collectSchemaReferences(schema, references);
    for (const reference of references) {
      if (reference.startsWith('#')) {
        continue;
      }
      let documentId: string;
      try {
        documentId = referenceDocumentId(reference, schema.$id);
      } catch {
        throw new Error(`Schema ${schema.$id} contains an invalid $ref: ${reference}`);
      }
      if (!ids.has(documentId)) {
        throw new Error(`Schema ${schema.$id} references a remote or unpackaged schema: ${reference}`);
      }
    }
  }

  return Object.freeze(schemas);
}

export const ACTIVE_PRODUCT_SCHEMA_COUNT = 26 as const;
export const ACTIVE_PRODUCT_SCHEMAS = createProductSchemaRegistry();

if (ACTIVE_PRODUCT_SCHEMAS.length !== ACTIVE_PRODUCT_SCHEMA_COUNT) {
  throw new Error(
    `Product schema registry expected ${ACTIVE_PRODUCT_SCHEMA_COUNT} schemas but found ${ACTIVE_PRODUCT_SCHEMAS.length}.`,
  );
}

export const ACTIVE_PRODUCT_SCHEMA_IDS = Object.freeze(
  ACTIVE_PRODUCT_SCHEMAS.map((schema) => schema.$id),
);
