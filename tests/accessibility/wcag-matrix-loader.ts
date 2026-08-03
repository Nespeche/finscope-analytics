import { readFileSync } from 'node:fs';

export type WcagApplicability = 'APPLICABLE' | 'NOT_APPLICABLE';
export type WcagLevel = 'A' | 'AA';

export interface WcagCriterion {
  readonly matrixId: string;
  readonly successCriterion: string;
  readonly level: WcagLevel;
  readonly name: string;
  readonly applicability: WcagApplicability;
  readonly components: readonly string[];
  readonly risk: string;
  readonly oracle: string;
  readonly testMethod: string;
  readonly automationPossible: boolean;
  readonly manualTestRequired: boolean;
  readonly fixtureRef: string;
  readonly releaseBlocking: boolean;
  readonly acceptanceCriterionIds: readonly string[];
  readonly notApplicableJustification?: string;
  readonly reclassificationTrigger?: string;
}

export interface WcagOracle {
  readonly successCriterion: string;
  readonly level: WcagLevel;
  readonly name: string;
  readonly applicability: WcagApplicability;
  readonly components: readonly string[];
  readonly risk: string;
  readonly oracle: string;
  readonly testMethod: string;
  readonly automationPossible: boolean;
  readonly manualTestRequired: boolean;
  readonly fixtureRef: string;
  readonly releaseBlocking: boolean;
  readonly notApplicableJustification?: string;
  readonly reclassificationTrigger?: string;
}

export interface LoadedWcagMatrix {
  readonly matrixId: string;
  readonly version: string;
  readonly criteria: readonly WcagCriterion[];
  readonly applicable: readonly WcagCriterion[];
  readonly notApplicable: readonly WcagCriterion[];
  readonly automatable: readonly WcagCriterion[];
  readonly manualRequired: readonly WcagCriterion[];
  readonly oracles: Readonly<Record<string, WcagOracle>>;
}

interface RawWcagOracle {
  readonly successCriterion: string;
  readonly level: string;
  readonly name: string;
  readonly applicability: string;
  readonly components: readonly string[];
  readonly risk: string;
  readonly oracle: string;
  readonly testMethod: string;
  readonly automationPossible: boolean;
  readonly manualTestRequired: boolean;
  readonly fixtureRef: string;
  readonly releaseBlocking: boolean;
  readonly notApplicableJustification?: string;
  readonly reclassificationTrigger?: string;
}

interface RawWcagCriterion extends RawWcagOracle {
  readonly acceptanceCriterionIds: readonly string[];
}

interface RawWcagMatrixDocument {
  readonly matrixId: string;
  readonly version: string;
  readonly criterionCount: number;
  readonly applicableCount: number;
  readonly notApplicableCount: number;
  readonly criteria: readonly RawWcagCriterion[];
}

interface RawWcagOracleInventory {
  readonly criterionCount: number;
  readonly applicableCount: number;
  readonly notApplicableCount: number;
  readonly oracles: Readonly<Record<string, RawWcagOracle>>;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(`WCAG_MATRIX_INVALID: ${message}`);
}

function readJsonDocument<T>(relativePath: string, label: string): T {
  const documentUrl = new URL(relativePath, import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(documentUrl, 'utf8'));
  assertCondition(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed), `${label} must be a JSON object`);
  return parsed as T;
}

const matrixJson = readJsonDocument<RawWcagMatrixDocument>(
  '../../specs/001-fundamental-analysis-platform/definitions/wcag-2.2-aa-matrix.json',
  'WCAG matrix',
);
const oracleInventoryJson = readJsonDocument<RawWcagOracleInventory>(
  '../../specs/001-fundamental-analysis-platform/fixtures/accessibility/wcag-oracle-inventory.json',
  'WCAG oracle inventory',
);

function criterionId(successCriterion: string): string {
  return `SC-${successCriterion.replaceAll('.', '-')}`;
}

function freezeCriterion(raw: RawWcagCriterion): WcagCriterion {
  const matrixId = criterionId(raw.successCriterion);
  return Object.freeze({
    matrixId,
    successCriterion: raw.successCriterion,
    level: raw.level as WcagLevel,
    name: raw.name,
    applicability: raw.applicability as WcagApplicability,
    components: Object.freeze([...raw.components]),
    risk: raw.risk,
    oracle: raw.oracle,
    testMethod: raw.testMethod,
    automationPossible: raw.automationPossible,
    manualTestRequired: raw.manualTestRequired,
    fixtureRef: raw.fixtureRef,
    releaseBlocking: raw.releaseBlocking,
    acceptanceCriterionIds: Object.freeze([...raw.acceptanceCriterionIds]),
    ...(raw.notApplicableJustification === undefined
      ? {}
      : { notApplicableJustification: raw.notApplicableJustification }),
    ...(raw.reclassificationTrigger === undefined
      ? {}
      : { reclassificationTrigger: raw.reclassificationTrigger }),
  });
}

function freezeOracle(raw: RawWcagOracle): WcagOracle {
  return Object.freeze({
    successCriterion: raw.successCriterion,
    level: raw.level as WcagLevel,
    name: raw.name,
    applicability: raw.applicability as WcagApplicability,
    components: Object.freeze([...raw.components]),
    risk: raw.risk,
    oracle: raw.oracle,
    testMethod: raw.testMethod,
    automationPossible: raw.automationPossible,
    manualTestRequired: raw.manualTestRequired,
    fixtureRef: raw.fixtureRef,
    releaseBlocking: raw.releaseBlocking,
    ...(raw.notApplicableJustification === undefined
      ? {}
      : { notApplicableJustification: raw.notApplicableJustification }),
    ...(raw.reclassificationTrigger === undefined
      ? {}
      : { reclassificationTrigger: raw.reclassificationTrigger }),
  });
}

export function loadWcagMatrix(): LoadedWcagMatrix {
  assertCondition(matrixJson.criterionCount === 55, 'matrix criterionCount must be 55');
  assertCondition(matrixJson.applicableCount === 43, 'matrix applicableCount must be 43');
  assertCondition(matrixJson.notApplicableCount === 12, 'matrix notApplicableCount must be 12');
  assertCondition(oracleInventoryJson.criterionCount === 55, 'oracle criterionCount must be 55');
  assertCondition(oracleInventoryJson.applicableCount === 43, 'oracle applicableCount must be 43');
  assertCondition(oracleInventoryJson.notApplicableCount === 12, 'oracle notApplicableCount must be 12');

  const criteria = Object.freeze(matrixJson.criteria.map(freezeCriterion));
  const identifiers = criteria.map((criterion) => criterion.matrixId);
  assertCondition(new Set(identifiers).size === criteria.length, 'criterion IDs must be unique');

  const oracleEntries = Object.entries(oracleInventoryJson.oracles).map(([id, raw]) => [
    id,
    freezeOracle(raw),
  ] as const);
  const oracles = Object.freeze(Object.fromEntries(oracleEntries)) as Readonly<Record<string, WcagOracle>>;
  assertCondition(Object.keys(oracles).length === 55, 'oracle inventory must contain 55 entries');

  for (const criterion of criteria) {
    const oracle = oracles[criterion.matrixId];
    assertCondition(oracle !== undefined, `${criterion.matrixId} has no fixture oracle`);
    assertCondition(oracle.successCriterion === criterion.successCriterion, `${criterion.matrixId} success criterion mismatch`);
    assertCondition(oracle.applicability === criterion.applicability, `${criterion.matrixId} applicability mismatch`);
    assertCondition(oracle.oracle === criterion.oracle, `${criterion.matrixId} oracle mismatch`);
    assertCondition(oracle.automationPossible === criterion.automationPossible, `${criterion.matrixId} automation mismatch`);
    assertCondition(oracle.manualTestRequired === criterion.manualTestRequired, `${criterion.matrixId} manual-test mismatch`);

    if (criterion.applicability === 'NOT_APPLICABLE') {
      assertCondition(criterion.notApplicableJustification?.trim(), `${criterion.matrixId} lacks N/A justification`);
      assertCondition(criterion.reclassificationTrigger?.trim(), `${criterion.matrixId} lacks reclassification trigger`);
      assertCondition(!criterion.automationPossible, `${criterion.matrixId} N/A criterion cannot be marked automatable`);
    }
  }

  const applicable = Object.freeze(criteria.filter((criterion) => criterion.applicability === 'APPLICABLE'));
  const notApplicable = Object.freeze(criteria.filter((criterion) => criterion.applicability === 'NOT_APPLICABLE'));
  const automatable = Object.freeze(applicable.filter((criterion) => criterion.automationPossible));
  const manualRequired = Object.freeze(criteria.filter((criterion) => criterion.manualTestRequired));

  assertCondition(applicable.length === 43, 'derived applicable count must be 43');
  assertCondition(notApplicable.length === 12, 'derived N/A count must be 12');
  assertCondition(automatable.length === 43, 'all 43 applicable criteria must retain an automated evidence entry');

  return Object.freeze({
    matrixId: matrixJson.matrixId,
    version: matrixJson.version,
    criteria,
    applicable,
    notApplicable,
    automatable,
    manualRequired,
    oracles,
  });
}

export const wcagMatrix = loadWcagMatrix();
