import matrixDocument from '../../specs/001-fundamental-analysis-platform/definitions/wcag-2.2-aa-matrix.json';
import oracleDocument from '../../specs/001-fundamental-analysis-platform/fixtures/accessibility/wcag-oracle-inventory.json';

export type OracleId = 'chart-table' | 'semantic' | 'responsive' | 'visual' | 'keyboard' | 'navigation' | 'pointer' | 'language' | 'context' | 'errors' | 'aria';
export interface AutomatedEvidencePlan {
  readonly successCriterion: string;
  readonly level: 'A' | 'AA';
  readonly name: string;
  readonly acceptanceCriterionIds: readonly string[];
  readonly route: string;
  readonly surface: string;
  readonly deterministicOracle: OracleId;
  readonly oracleStatement: string;
  readonly evidence: string;
  readonly result: 'PENDING_EXECUTION';
  readonly manualClosureRequired: boolean;
}

type Criterion = (typeof matrixDocument.criteria)[number];
const routes: Readonly<Record<string, string>> = Object.freeze({
  '1.1.1': 'Price analysis', '1.3.1': 'Data management', '1.3.2': 'Facts', '1.3.3': 'Price import',
  '1.3.4': 'Issuer search', '1.4.1': 'Insights', '1.4.3': 'Home', '1.4.4': 'Fundamental metrics',
  '1.4.5': 'Home', '1.4.10': 'Data management', '1.4.11': 'Home', '1.4.12': 'Facts',
  '1.4.13': 'Home', '2.1.1': 'Issuer search', '2.1.2': 'Data management', '2.1.4': 'Home',
  '2.2.2': 'Home', '2.3.1': 'Home', '2.4.1': 'Home', '2.4.2': 'Issuer search',
  '2.4.3': 'Issuer search', '2.4.4': 'Fundamental metrics', '2.4.5': 'Home', '2.4.6': 'Facts',
  '2.4.7': 'Home', '2.4.11': 'Data management', '2.5.2': 'Data management', '2.5.3': 'Privacy settings',
  '2.5.8': 'Home', '3.1.1': 'Home', '3.1.2': 'Facts', '3.2.1': 'Issuer search',
  '3.2.2': 'Privacy settings', '3.2.3': 'Home', '3.2.4': 'Data management', '3.2.6': 'Home',
  '3.3.1': 'Issuer search', '3.3.2': 'Price import', '3.3.3': 'Issuer search', '3.3.4': 'Data management',
  '3.3.7': 'Privacy settings', '4.1.2': 'Price import', '4.1.3': 'SEC acquisition',
});

function oracleFor(sc: string): OracleId {
  if (sc === '1.1.1') return 'chart-table';
  if (['1.3.1','1.3.2','1.3.3','2.4.6'].includes(sc)) return 'semantic';
  if (['1.3.4','1.4.4','1.4.10','1.4.12'].includes(sc)) return 'responsive';
  if (sc.startsWith('1.4.') || sc.startsWith('2.2.') || sc.startsWith('2.3.')) return 'visual';
  if (sc.startsWith('2.1.') || ['2.4.3','2.4.7','2.4.11'].includes(sc)) return 'keyboard';
  if (sc.startsWith('2.4.')) return 'navigation';
  if (sc.startsWith('2.5.')) return 'pointer';
  if (sc.startsWith('3.1.')) return 'language';
  if (sc.startsWith('3.2.')) return 'context';
  if (sc.startsWith('3.3.')) return 'errors';
  return 'aria';
}

function validate(): readonly Criterion[] {
  const criteria = matrixDocument.criteria;
  if (matrixDocument.criterionCount !== 55 || matrixDocument.applicableCount !== 43 || matrixDocument.notApplicableCount !== 12) throw new Error('WCAG_MATRIX_COUNT_MISMATCH');
  if (oracleDocument.criterionCount !== 55 || Object.keys(oracleDocument.oracles).length !== 55) throw new Error('WCAG_ORACLE_COUNT_MISMATCH');
  const ids = criteria.map((item) => item.successCriterion);
  if (new Set(ids).size !== ids.length) throw new Error('WCAG_DUPLICATE_CRITERION');
  for (const item of criteria) {
    const oracle = oracleDocument.oracles[item.successCriterion as keyof typeof oracleDocument.oracles];
    if (oracle === undefined || oracle.applicability !== item.applicability || item.acceptanceCriterionIds.length === 0) throw new Error(`WCAG_ORACLE_DRIFT:${item.successCriterion}`);
  }
  return criteria;
}

export function loadWcagMatrix(): readonly Criterion[] { return validate(); }

export function loadAutomatedEvidencePlans(): readonly AutomatedEvidencePlan[] {
  return Object.freeze(validate().filter((item) => item.applicability === 'APPLICABLE' && item.automationPossible).map((item) => Object.freeze({
    successCriterion: item.successCriterion,
    level: item.level as 'A' | 'AA',
    name: item.name,
    acceptanceCriterionIds: Object.freeze([...item.acceptanceCriterionIds]),
    route: routes[item.successCriterion] ?? 'Home',
    surface: `${routes[item.successCriterion] ?? 'Home'} — ${item.name}`,
    deterministicOracle: oracleFor(item.successCriterion),
    oracleStatement: item.oracle,
    evidence: `${item.fixtureRef}; ${item.testMethod}`,
    result: 'PENDING_EXECUTION' as const,
    manualClosureRequired: item.manualTestRequired,
  })));
}
