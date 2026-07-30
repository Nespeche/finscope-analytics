import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import acceptanceCriteriaCatalog from '../../specs/001-fundamental-analysis-platform/definitions/acceptance-criteria-catalog.json';
import accountingProfileCatalog from '../../specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json';
import cacheAndRefreshPolicy from '../../specs/001-fundamental-analysis-platform/contracts/cache-and-refresh-policy.json';
import fingerprintProjections from '../../specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json';
import localExportRestoreContract from '../../specs/001-fundamental-analysis-platform/contracts/local-export-restore-contract.json';
import secFilingFactSelectionPolicy from '../../specs/001-fundamental-analysis-platform/contracts/sec-filing-fact-selection-policy.json';
import securityAndInputLimits from '../../specs/001-fundamental-analysis-platform/contracts/security-and-input-limits.json';
import formulaCatalog from '../../specs/001-fundamental-analysis-platform/definitions/formula-catalog.json';
import insightRuleCatalog from '../../specs/001-fundamental-analysis-platform/definitions/insight-rule-catalog.json';
import metricCatalog from '../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import qualityModelCatalog from '../../specs/001-fundamental-analysis-platform/definitions/quality-model-catalog.json';
import stateAndCapabilityCatalog from '../../specs/001-fundamental-analysis-platform/definitions/state-and-capability-catalog.json';
import wcag22AaMatrix from '../../specs/001-fundamental-analysis-platform/definitions/wcag-2.2-aa-matrix.json';
import xbrlMappingCatalog from '../../specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json';
import cloudflareFreeBudget from '../../specs/001-fundamental-analysis-platform/governance/cloudflare-free-budget.json';
import requirementsAcceptanceTraceability from '../../specs/001-fundamental-analysis-platform/governance/requirements-acceptance-traceability.json';
import authorityReferenceNegativeFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/acceptance/authority-ref-negative.json';
import analysisResultFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import fundamentalBundleFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import formulaTestVectors from '../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json';
import formulaVectorNegativeFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-vectors-negative.json';
import historicalPriceOverlayFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/price/historical-price-overlay-test-vectors.json';
import localOperationIssueFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/problems/local-operation-issue-test-vectors.json';
import problemDetailsFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/problems/problem-details-test-vectors.json';
import secSchemaExamples from '../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-schema-examples.json';
import storageRecordFixtures from '../../specs/001-fundamental-analysis-platform/fixtures/storage/storage-record-schema-examples.json';
import {
  ACTIVE_PRODUCT_SCHEMA_COUNT,
  ACTIVE_PRODUCT_SCHEMA_IDS,
  ACTIVE_PRODUCT_SCHEMAS,
  createProductSchemaRegistry,
} from '../../src/core/schema-registry';
import { createProductSchemaValidator } from '../../src/core/schema-validator';

const schemaBase = 'https://finscope.local/schemas/';
const schemaId = (fileName: string): string => `${schemaBase}${fileName}`;

function expectValid(reference: string, input: unknown): void {
  const result = validator.validate(reference, input);
  expect(result, reference).toEqual(expect.objectContaining({ valid: true, value: input }));
}

function expectInvalid(reference: string, input: unknown): void {
  const result = validator.validate(reference, input);
  expect(result.valid, reference).toBe(false);
  if (!result.valid) {
    expect(result.errors.length, reference).toBeGreaterThan(0);
  }
}

const validator = createProductSchemaValidator();

describe('active Draft 2020-12 product schema registry', () => {
  it('registers and compiles exactly 26 unique schemas once in deterministic order', () => {
    expect(ACTIVE_PRODUCT_SCHEMAS).toHaveLength(ACTIVE_PRODUCT_SCHEMA_COUNT);
    expect(new Set(ACTIVE_PRODUCT_SCHEMA_IDS).size).toBe(ACTIVE_PRODUCT_SCHEMA_COUNT);
    expect(ACTIVE_PRODUCT_SCHEMA_IDS).toEqual([...ACTIVE_PRODUCT_SCHEMA_IDS].sort((left, right) => (
      left.localeCompare(right, 'en')
    )));
    expect(validator.compilationCount).toBe(ACTIVE_PRODUCT_SCHEMA_COUNT);
    expect(validator.compiledSchemaIds).toEqual(ACTIVE_PRODUCT_SCHEMA_IDS);
  });

  it('compiles and validates the active acceptance and traceability documents', () => {
    const acceptanceSchema = schemaId('acceptance-criteria-catalog.schema.json');
    const traceabilitySchema = schemaId('requirements-acceptance-traceability.schema.json');

    expect(validator.compiledSchemaIds).toContain(acceptanceSchema);
    expect(validator.compiledSchemaIds).toContain(traceabilitySchema);
    expectValid(acceptanceSchema, acceptanceCriteriaCatalog);
    expectValid(traceabilitySchema, requirementsAcceptanceTraceability);
  });

  it('blocks missing identifiers, duplicates and remote or unpackaged references', () => {
    expect(() => createProductSchemaRegistry([{}])).toThrow(/no non-empty \$id/u);
    const duplicate = { $id: 'https://finscope.local/schemas/duplicate.schema.json', type: 'object' };
    expect(() => createProductSchemaRegistry([duplicate, structuredClone(duplicate)]))
      .toThrow(/Duplicate product schema \$id/u);
    expect(() => createProductSchemaRegistry([{
      $id: 'https://finscope.local/schemas/local.schema.json',
      $ref: 'https://remote.example/schema.json',
    }])).toThrow(/remote or unpackaged schema/u);
  });

  it('validates conformant active catalogs and policies used as product-schema examples', () => {
    const documents: readonly (readonly [string, unknown])[] = [
      ['accounting-profile-catalog.schema.json', accountingProfileCatalog],
      ['cache-and-refresh-policy.schema.json', cacheAndRefreshPolicy],
      ['cloudflare-free-budget.schema.json', cloudflareFreeBudget],
      ['fingerprint-projections.schema.json', fingerprintProjections],
      ['formula-catalog.schema.json', formulaCatalog],
      ['formula-vectors.schema.json', formulaTestVectors],
      ['insight-rule-catalog.schema.json', insightRuleCatalog],
      ['local-export-restore-contract.schema.json', localExportRestoreContract],
      ['metric-catalog.schema.json', metricCatalog],
      ['quality-model-catalog.schema.json', qualityModelCatalog],
      ['sec-filing-fact-selection-policy.schema.json', secFilingFactSelectionPolicy],
      ['security-and-input-limits.schema.json', securityAndInputLimits],
      ['state-and-capability-catalog.schema.json', stateAndCapabilityCatalog],
      ['wcag-2.2-aa-matrix.schema.json', wcag22AaMatrix],
      ['xbrl-mapping-catalog.schema.json', xbrlMappingCatalog],
    ];
    for (const [fileName, document] of documents) {
      expectValid(schemaId(fileName), document);
    }
  });

  it('validates all published positive runtime examples and local references', () => {
    for (const fixture of analysisResultFixtures.validFixtures) {
      expectValid(schemaId('analysis-results.schema.json'), fixture.input);
    }
    for (const fixture of fundamentalBundleFixtures.validFixtures) {
      expectValid(schemaId('fundamental-bundle.schema.json'), fixture.input);
    }
    for (const fixture of historicalPriceOverlayFixtures.fixtures) {
      if (fixture.expectedSchemaValid === true && 'input' in fixture) {
        expectValid(schemaId('historical-price-overlay.schema.json'), fixture.input);
      }
    }
    for (const fixture of localOperationIssueFixtures.fixtures) {
      expectValid(schemaId('local-operation-issue.schema.json'), fixture.input);
    }
    for (const fixture of problemDetailsFixtures.validFixtures) {
      expectValid(schemaId('problem-details.schema.json'), fixture.input);
    }
    for (const fixture of secSchemaExamples.validFixtures) {
      expectValid(schemaId('sec-acquisition.schema.json'), fixture.input);
    }
    for (const fixture of storageRecordFixtures.validFixtures) {
      expectValid(schemaId('storage-records.schema.json'), fixture.input);
    }
    for (const rule of insightRuleCatalog.rules) {
      expectValid(`${schemaId('rule-node.schema.json')}#/$defs/RuleNode`, rule.ast);
    }
    expectValid(`${schemaId('common.schema.json')}#/$defs/IsoDate`, '2024-02-29');
    expectValid(
      `${schemaId('acceptance-criteria-catalog.schema.json')}#/$defs/authorityRef`,
      'specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json',
    );
  });

  it('rejects every published invalid schema fixture', () => {
    for (const fixture of authorityReferenceNegativeFixtures.cases) {
      expectInvalid(
        `${schemaId('acceptance-criteria-catalog.schema.json')}#/$defs/authorityRef`,
        fixture.authorityRef,
      );
    }
    for (const fixture of analysisResultFixtures.negativeFixtures) {
      expectInvalid(schemaId('analysis-results.schema.json'), fixture.input);
    }
    for (const fixture of fundamentalBundleFixtures.negativeFixtures) {
      expectInvalid(schemaId('fundamental-bundle.schema.json'), fixture.input);
    }
    for (const fixture of formulaVectorNegativeFixtures.cases) {
      expectInvalid(`${schemaId('formula-vectors.schema.json')}#/$defs/vector`, fixture.instance);
    }
    for (const fixture of historicalPriceOverlayFixtures.fixtures) {
      if (fixture.expectedSchemaValid === false && 'input' in fixture) {
        expectInvalid(schemaId('historical-price-overlay.schema.json'), fixture.input);
      }
    }
    for (const fixture of problemDetailsFixtures.negativeFixtures) {
      expectInvalid(schemaId('problem-details.schema.json'), fixture.input);
    }
    for (const fixture of secSchemaExamples.negativeFixtures) {
      expectInvalid(schemaId('sec-acquisition.schema.json'), fixture.input);
    }
  });

  it('fails closed for required, type, additionalProperties and custom format mutations without modifying input', () => {
    const missingRequired = structuredClone(accountingProfileCatalog) as Record<string, unknown>;
    delete missingRequired.catalogId;
    expectInvalid(schemaId('accounting-profile-catalog.schema.json'), missingRequired);

    const wrongType = structuredClone(accountingProfileCatalog) as Record<string, unknown>;
    wrongType.profiles = 'not-an-array';
    const beforeWrongType = structuredClone(wrongType);
    expectInvalid(schemaId('accounting-profile-catalog.schema.json'), wrongType);
    expect(wrongType).toEqual(beforeWrongType);

    const additionalProperty = {
      ...structuredClone(accountingProfileCatalog),
      unauthorizedRuntimeField: true,
    };
    expectInvalid(schemaId('accounting-profile-catalog.schema.json'), additionalProperty);

    expectInvalid(`${schemaId('common.schema.json')}#/$defs/IsoDate`, '2025-02-29');
    const invalidDateTime = structuredClone(fundamentalBundleFixtures.validFixtures[0]!.input);
    invalidDateTime.createdAt = '2026-07-22T13:45:12';
    expectInvalid(schemaId('fundamental-bundle.schema.json'), invalidDateTime);

    const invalidUri = structuredClone(cloudflareFreeBudget) as typeof cloudflareFreeBudget;
    invalidUri.officialSources[0] = {
      ...invalidUri.officialSources[0],
      url: '/relative/not-absolute',
    };
    expectInvalid(schemaId('cloudflare-free-budget.schema.json'), invalidUri);
  });

  it('returns normalized stable errors and never exposes partial typed data on failure', () => {
    const result = validator.validate<{ catalogId: string }>(
      schemaId('accounting-profile-catalog.schema.json'),
      { count: '84', unauthorized: true },
    );
    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error('Invalid payload unexpectedly exposed typed data.');
    }
    expect(result).not.toHaveProperty('value');
    const sortKeys = result.errors.map((error) => (
      `${error.instancePath}\u0000${error.schemaPath}\u0000${error.keyword}`
    ));
    expect(sortKeys).toEqual([...sortKeys].sort((left, right) => left.localeCompare(right, 'en')));
  });
});


const operationalSchemaDirectory = 'implementation-control/schemas';
const operationalSchemaNames = [
  'authority-matrix.schema.json',
  'control-plane-validation-evidence.schema.json',
  'github-release-handoff.schema.json',
  'github-validation-evidence.schema.json',
  'implementation-batch-map.schema.json',
  'implementation-batch-report.schema.json',
  'implementation-batch.schema.json',
  'implementation-state.schema.json',
  'local-validation-evidence.schema.json',
  'task-source-lock.schema.json',
] as const;

async function readJsonDocument(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function createOperationalSchemaRegistry(): Promise<Ajv2020> {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });
  for (const name of operationalSchemaNames) {
    ajv.addSchema(await readJsonDocument(join(operationalSchemaDirectory, name)));
  }
  return ajv;
}

const sha256Fixture = 'a'.repeat(64);
const localValidationEvidenceFixture = {
  $schema: 'implementation-control/schemas/local-validation-evidence.schema.json',
  schemaVersion: '1.1.0',
  batchId: 'B02',
  candidateRoot: 'C:\\FinScope\\B02-r6\\FinScope_v0.21.2',
  candidate: {
    logicalZipName: 'FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip',
    zipSha256: sha256Fixture,
    sidecarFileName: 'FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip.sha256',
    sidecarExpectedSha256: sha256Fixture,
    sidecarMatch: true,
    rootDirectory: 'FinScope_v0.21.2',
    archiveFileCount: 1,
    archiveRootCount: 1,
    archiveCrcRead: true,
    archiveSafePaths: true,
    archiveMatchesExtraction: true,
    archiveSymlinksDetected: 0,
    archiveCaseFoldCollisionsDetected: 0,
    archiveNestedArchivesDetected: 0,
    fileManifestSha256: sha256Fixture,
    fileManifestValid: true,
    inventorySha256: sha256Fixture,
    inventoryValid: true,
    metadataSha256: sha256Fixture,
    metadataValid: true,
    extractedTreeSha256: sha256Fixture,
  },
  environment: {
    operatingSystem: 'Microsoft Windows 11 Pro',
    osVersion: '10.0.26100.0',
    osArchitecture: 'X64',
    processArchitecture: 'X64',
    powerShellVersion: '7.5.2',
    powerShellEdition: 'Core',
    nodeVersion: 'v22.16.0',
    npmVersion: '10.9.2',
  },
  startedAt: '2026-07-22T21:00:00.0000000-03:00',
  finishedAt: '2026-07-22T21:01:00.0000000-03:00',
  status: 'PASS',
  commandSummary: {
    expectedCommandCount: 1,
    recordedCommandCount: 1,
    requiredPassCount: 1,
    requiredFailCount: 0,
    requiredNotRunCount: 0,
  },
  commands: [{
    id: 'typecheck',
    category: 'static',
    command: 'npm run typecheck',
    required: true,
    startedAt: '2026-07-22T21:00:00.0000000-03:00',
    finishedAt: '2026-07-22T21:00:01.0000000-03:00',
    durationMilliseconds: 1000,
    exitCode: 0,
    status: 'PASS',
    stdoutLog: 'logs/typecheck.stdout.log',
    stderrLog: 'logs/typecheck.stderr.log',
    stdoutSha256: sha256Fixture,
    stderrSha256: sha256Fixture,
    stdoutBytes: 100,
    stderrBytes: 0,
    reason: null,
  }],
  specifyTreeSha256Before: sha256Fixture,
  specifyTreeSha256After: sha256Fixture,
  sourceTasksSha256Before: sha256Fixture,
  sourceTasksSha256After: sha256Fixture,
  targetFileHashesBefore: { 'src/main.ts': sha256Fixture },
  targetFileHashesAfter: { 'src/main.ts': sha256Fixture },
  targetFilesUnchanged: true,
  regenerableArtifacts: [{
    path: 'node_modules',
    presentAfterValidation: true,
    packageDisposition: 'EXCLUDED_FROM_CANDIDATE_PACKAGE',
  }],
} as const;

const controlPlaneEvidenceFixture = {
  $schema: 'implementation-control/schemas/control-plane-validation-evidence.schema.json',
  schemaVersion: '1.0.0',
  validationType: 'CONTROL_PLANE_REMEDIATION',
  candidateRoot: 'C:\\FinScope\\validation\\FinScope_v0.21.3',
  candidate: {
    logicalZipName: 'FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_candidate_r1.zip',
    zipSha256: sha256Fixture,
    sidecarFileName: 'FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_candidate_r1.zip',
    sidecarExpectedSha256: sha256Fixture,
    sidecarMatch: true,
    sidecarFileNameMatch: true,
    rootDirectory: 'FinScope_v0.21.3',
    archiveFileCount: 1,
    archiveRootCount: 1,
    archiveCrcRead: true,
    archiveSafePaths: true,
    archiveMatchesExtraction: true,
    archiveSymlinksDetected: 0,
    archiveCaseFoldCollisionsDetected: 0,
    archiveNestedArchivesDetected: 0,
    fileManifestSha256: sha256Fixture,
    fileManifestValid: true,
    inventorySha256: sha256Fixture,
    inventoryValid: true,
    metadataSha256: sha256Fixture,
    metadataValid: true,
    extractedTreeSha256: sha256Fixture,
  },
  environment: localValidationEvidenceFixture.environment,
  startedAt: '2026-07-23T21:00:00.0000000-03:00',
  finishedAt: '2026-07-23T21:01:00.0000000-03:00',
  status: 'PASS',
  preflight: {
    status: 'PASS',
    passCount: 1,
    failCount: 0,
    checks: [{ id: 'CONTROL_PLANE_STATE_VALID', status: 'PASS', details: '990 checks passed.' }],
  },
  commandSummary: localValidationEvidenceFixture.commandSummary,
  commands: localValidationEvidenceFixture.commands,
  invariants: {
    specifyTreeSha256Before: sha256Fixture,
    specifyTreeSha256After: sha256Fixture,
    sourceTasksSha256Before: sha256Fixture,
    sourceTasksSha256After: sha256Fixture,
    controlFileHashesBefore: { 'implementation-control/TASK_SOURCE_LOCK.json': sha256Fixture },
    controlFileHashesAfter: { 'implementation-control/TASK_SOURCE_LOCK.json': sha256Fixture },
    controlFilesUnchanged: true,
    sourceTreeSha256Before: sha256Fixture,
    sourceTreeSha256After: sha256Fixture,
    sourceTreeUnchanged: true,
  },
  schemaValidation: {
    schemaPath: 'implementation-control/schemas/control-plane-validation-evidence.schema.json',
    status: 'PASS',
    validatorCommand: 'node Validate-ControlPlaneEvidence.mjs schema evidence',
  },
  regenerableArtifacts: localValidationEvidenceFixture.regenerableArtifacts,
} as const;

describe('operational Draft 2020-12 schema registry', () => {
  it('compiles all ten operational schemas and validates every active JSON control document', async () => {
    const names = (await readdir(operationalSchemaDirectory))
      .filter((name) => name.endsWith('.schema.json'))
      .sort();
    expect(names).toEqual([...operationalSchemaNames].sort());

    const ajv = await createOperationalSchemaRegistry();
    for (const name of operationalSchemaNames) {
      const schema = await readJsonDocument(join(operationalSchemaDirectory, name)) as { readonly $id: string };
      expect(ajv.getSchema(schema.$id), name).toBeTypeOf('function');
    }

    const documents: readonly (readonly [string, string])[] = [
      ['https://finscope.local/schemas/authority-matrix.schema.json', 'implementation-control/AUTHORITY_MATRIX.json'],
      ['https://finscope.local/schemas/implementation-batch-map.schema.json', 'implementation-control/IMPLEMENTATION_BATCH_MAP.json'],
      ['https://finscope.local/schemas/implementation-state.schema.json', 'implementation-control/IMPLEMENTATION_STATE.json'],
      ['https://finscope.local/schemas/task-source-lock.schema.json', 'implementation-control/TASK_SOURCE_LOCK.json'],
    ];
    for (const [schemaReference, documentPath] of documents) {
      const validate = ajv.getSchema(schemaReference);
      expect(validate, schemaReference).toBeTypeOf('function');
      const document = await readJsonDocument(documentPath);
      expect(validate?.(document), JSON.stringify(validate?.errors)).toBe(true);
    }

    const validateBatch = ajv.getSchema('https://finscope.local/schemas/implementation-batch.schema.json');
    expect(validateBatch).toBeTypeOf('function');
    for (const name of (await readdir('implementation-control/batches')).filter((value) => /^B\d{2}\.json$/u.test(value)).sort()) {
      expect(validateBatch?.(await readJsonDocument(join('implementation-control/batches', name))), `${name}: ${JSON.stringify(validateBatch?.errors)}`).toBe(true);
    }

    const validateEvidence = ajv.getSchema('https://finscope.local/schemas/local-validation-evidence.schema.json');
    expect(validateEvidence).toBeTypeOf('function');
    expect(validateEvidence?.(localValidationEvidenceFixture), JSON.stringify(validateEvidence?.errors)).toBe(true);

    const validateControlPlaneEvidence = ajv.getSchema('https://finscope.local/schemas/control-plane-validation-evidence.schema.json');
    expect(validateControlPlaneEvidence).toBeTypeOf('function');
    expect(validateControlPlaneEvidence?.(controlPlaneEvidenceFixture), JSON.stringify(validateControlPlaneEvidence?.errors)).toBe(true);
  });

  it('keeps runner transport metadata outside the normative implementation state', async () => {
    const state = await readJsonDocument('implementation-control/IMPLEMENTATION_STATE.json') as {
      readonly validationWorkflow: Readonly<Record<string, unknown>>;
    };
    expect(Object.keys(state.validationWorkflow).sort()).toEqual([
      'candidatePromotionRule',
      'evidenceSchema',
      'localProtocol',
      'pendingRuntimeValidationBatches',
    ]);
    for (const forbidden of [
      'singleRunnerRequired',
      'activeRunner',
      'activeRunnerSha256',
      'independentPreflightScriptRequired',
      'integratedPreflightSwitch',
    ]) {
      expect(state.validationWorkflow).not.toHaveProperty(forbidden);
    }
  });

  it('rejects missing environment data, false PASS exit codes and unrecorded NOT_RUN reasons', async () => {
    const ajv = await createOperationalSchemaRegistry();
    const validate = ajv.getSchema('https://finscope.local/schemas/local-validation-evidence.schema.json');
    expect(validate).toBeTypeOf('function');

    const missingEnvironment = structuredClone(localValidationEvidenceFixture) as Record<string, unknown>;
    delete missingEnvironment.environment;
    expect(validate?.(missingEnvironment)).toBe(false);

    const falsePass = structuredClone(localValidationEvidenceFixture) as unknown as {
      commands: Array<Record<string, unknown>>;
    };
    falsePass.commands[0]!.exitCode = 1;
    expect(validate?.(falsePass)).toBe(false);

    const topLevelFalsePass = structuredClone(localValidationEvidenceFixture) as unknown as {
      commandSummary: Record<string, unknown>;
      commands: Array<Record<string, unknown>>;
    };
    Object.assign(topLevelFalsePass.commands[0]!, {
      exitCode: 0,
      status: 'FAIL',
      reason: 'SKIPPED_OR_PENDING_TESTS_REPORTED',
    });
    topLevelFalsePass.commandSummary.requiredPassCount = 0;
    topLevelFalsePass.commandSummary.requiredFailCount = 1;
    expect(validate?.(topLevelFalsePass)).toBe(false);

    const processZeroPolicyFailure = structuredClone(localValidationEvidenceFixture) as unknown as {
      status: string;
      commandSummary: Record<string, unknown>;
      commands: Array<Record<string, unknown>>;
    };
    processZeroPolicyFailure.status = 'FAIL';
    Object.assign(processZeroPolicyFailure.commands[0]!, {
      exitCode: 0,
      status: 'FAIL',
      reason: 'SKIPPED_OR_PENDING_TESTS_REPORTED',
    });
    processZeroPolicyFailure.commandSummary.requiredPassCount = 0;
    processZeroPolicyFailure.commandSummary.requiredFailCount = 1;
    expect(validate?.(processZeroPolicyFailure), JSON.stringify(validate?.errors)).toBe(true);

    const invalidIntegrityPass = structuredClone(localValidationEvidenceFixture) as unknown as {
      candidate: Record<string, unknown>;
    };
    invalidIntegrityPass.candidate.sidecarMatch = false;
    expect(validate?.(invalidIntegrityPass)).toBe(false);

    const unexplainedNotRun = structuredClone(localValidationEvidenceFixture) as unknown as {
      commands: Array<Record<string, unknown>>;
    };
    Object.assign(unexplainedNotRun.commands[0]!, {
      startedAt: null,
      finishedAt: null,
      durationMilliseconds: 0,
      exitCode: null,
      status: 'NOT_RUN',
      stdoutLog: null,
      stderrLog: null,
      stdoutSha256: null,
      stderrSha256: null,
      stdoutBytes: 0,
      stderrBytes: 0,
      reason: null,
    });
    expect(validate?.(unexplainedNotRun)).toBe(false);
  });
});
