import stateAndCapabilityCatalog from '../../../specs/001-fundamental-analysis-platform/definitions/state-and-capability-catalog.json';
import { createProductSchemaValidator } from '../../core/schema-validator';

const STATE_CATALOG_SCHEMA =
  'https://finscope.local/schemas/state-and-capability-catalog.schema.json';

export const PIPELINE_STATES = Object.freeze([
  'idle',
  'checking',
  'acquiring',
  'normalizing',
  'analyzing',
  'ready',
  'partial',
  'failed',
  'cancelled',
] as const);

export type PipelineState = (typeof PIPELINE_STATES)[number];

export interface TransitionAuthorityRecord {
  readonly from: PipelineState;
  readonly event: string;
  readonly to: PipelineState;
  readonly guard: string;
  readonly operationId: string;
}

export interface TransitionPair {
  readonly from: PipelineState;
  readonly to: PipelineState;
  readonly permitted: boolean;
  readonly events: readonly string[];
  readonly operationIds: readonly string[];
}

interface StateCatalogDocument {
  readonly pipelineStates: readonly string[];
  readonly defaultRule: string;
  readonly transitions: readonly TransitionAuthorityRecord[];
}

function freezeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function pairKey(from: PipelineState, to: PipelineState): string {
  return `${from}\u0000${to}`;
}

function assertAuthoritativeCatalog(input: unknown): StateCatalogDocument {
  const validator = createProductSchemaValidator();
  const result = validator.validate<StateCatalogDocument>(STATE_CATALOG_SCHEMA, input);
  if (!result.valid) {
    throw new Error(`Invalid state-and-capability authority: ${JSON.stringify(result.errors)}`);
  }
  if (JSON.stringify(result.value.pipelineStates) !== JSON.stringify(PIPELINE_STATES)) {
    throw new Error('Pipeline state order differs from the active authority.');
  }
  if (result.value.defaultRule !== 'any from/event/to tuple not listed is prohibited') {
    throw new Error('The active state authority does not fail closed for unlisted transitions.');
  }
  return result.value;
}

const authoritativeCatalog = assertAuthoritativeCatalog(stateAndCapabilityCatalog);

export const AUTHORIZED_TRANSITIONS: readonly TransitionAuthorityRecord[] = Object.freeze(
  authoritativeCatalog.transitions.map((transition) => Object.freeze({ ...transition })),
);

const transitionTriples = new Set(
  AUTHORIZED_TRANSITIONS.map(({ from, event, to }) => `${from}\u0000${event}\u0000${to}`),
);

const pairEntries = new Map<string, TransitionPair>();
for (const from of PIPELINE_STATES) {
  for (const to of PIPELINE_STATES) {
    const transitions = AUTHORIZED_TRANSITIONS.filter((entry) => entry.from === from && entry.to === to);
    pairEntries.set(pairKey(from, to), Object.freeze({
      from,
      to,
      permitted: transitions.length > 0,
      events: freezeStrings(transitions.map((entry) => entry.event)),
      operationIds: freezeStrings(transitions.map((entry) => entry.operationId)),
    }));
  }
}

export const TRANSITION_PAIR_COUNT = PIPELINE_STATES.length * PIPELINE_STATES.length;
export const TRANSITION_PAIRS: readonly TransitionPair[] = Object.freeze([...pairEntries.values()]);

if (TRANSITION_PAIRS.length !== 81) {
  throw new Error(`Expected 81 pipeline-state pairs, found ${TRANSITION_PAIRS.length}.`);
}

export function getTransitionPair(from: PipelineState, to: PipelineState): TransitionPair {
  const pair = pairEntries.get(pairKey(from, to));
  if (pair === undefined) {
    throw new Error(`Unknown pipeline-state pair: ${from} -> ${to}`);
  }
  return pair;
}

export function isTransitionAllowed(
  from: PipelineState,
  event: string,
  to: PipelineState,
): boolean {
  return transitionTriples.has(`${from}\u0000${event}\u0000${to}`);
}

export function assertTransitionAllowed(
  from: PipelineState,
  event: string,
  to: PipelineState,
): void {
  if (!isTransitionAllowed(from, event, to)) {
    throw new Error(`PROHIBITED_PIPELINE_TRANSITION:${from}:${event}:${to}`);
  }
}
