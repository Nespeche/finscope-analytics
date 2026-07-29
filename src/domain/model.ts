const cikBrand: unique symbol = Symbol('Cik');

export type Cik = string & { readonly [cikBrand]: true };

export const CIK_PATTERN = /^[0-9]{10}$/u;

export type AccountingStandard = 'us_gaap' | 'ifrs' | 'unknown';
export type EntityType =
  | 'operating_company'
  | 'financial_institution'
  | 'insurance'
  | 'reit'
  | 'unknown';

export type FactResolutionState = 'resolved' | 'absent' | 'ambiguous' | 'incompatible';
export type CoverageState = 'complete' | 'partial' | 'missing' | 'not_applicable';
export type MetricState =
  | 'available'
  | 'partial'
  | 'insufficient'
  | 'not_applicable'
  | 'not_meaningful';
export type RuleState = 'triggered' | 'not_triggered' | 'not_evaluable';
export type SynthesisState =
  | 'insufficient_information'
  | 'neutral'
  | 'favorable'
  | 'unfavorable'
  | 'mixed';
export type QualityClassification = 'verified' | 'usable_with_caveats' | 'insufficient';

export interface IssuerIdentity {
  readonly cik: Cik;
  readonly legalName: string;
  readonly accountingStandard: AccountingStandard;
  readonly entityType: EntityType;
  readonly analysisProfile: string;
}

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepReadonly<T> =
  T extends Primitive ? T
    : T extends (...args: readonly unknown[]) => unknown ? T
      : T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[]
        : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
          : T;

export function isCik(value: unknown): value is Cik {
  return typeof value === 'string' && CIK_PATTERN.test(value);
}

export function parseCik(value: unknown): Cik {
  if (!isCik(value)) {
    throw new TypeError('CIK must contain exactly ten ASCII digits.');
  }
  return value;
}

export function freezeDomainRecord<T>(value: T): DeepReadonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeDomainRecord(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export function cloneAndFreezeDomainRecord<T>(value: T): DeepReadonly<T> {
  return freezeDomainRecord(structuredClone(value));
}
