export const CONSENT_KINDS = Object.freeze([
  'refreshConsent',
  'storageConsent',
] as const);

export type ConsentKind = typeof CONSENT_KINDS[number];

export interface ConsentRecord {
  readonly kind: ConsentKind;
  readonly granted: boolean;
  readonly revision: number;
}

export interface ConsentSnapshot {
  readonly refreshConsent: ConsentRecord;
  readonly storageConsent: ConsentRecord;
}

export type OptionalRefreshResult<TResult> =
  | Readonly<{ mode: 'local_only'; value: undefined }>
  | Readonly<{ mode: 'refreshed'; value: TResult }>;

export type OptionalPersistenceResult<TResult> =
  | Readonly<{ mode: 'memory_only'; value: undefined }>
  | Readonly<{ mode: 'persisted'; value: TResult }>;

function createDefaultRecord(kind: ConsentKind): ConsentRecord {
  return Object.freeze({ kind, granted: false, revision: 0 });
}

function nextRecord(previous: ConsentRecord, granted: boolean): ConsentRecord {
  if (previous.granted === granted) {
    return previous;
  }
  return Object.freeze({
    kind: previous.kind,
    granted,
    revision: previous.revision + 1,
  });
}

export class ConsentRepository {
  #refreshConsent = createDefaultRecord('refreshConsent');
  #storageConsent = createDefaultRecord('storageConsent');

  read(kind: ConsentKind): ConsentRecord {
    return kind === 'refreshConsent' ? this.#refreshConsent : this.#storageConsent;
  }

  snapshot(): ConsentSnapshot {
    return Object.freeze({
      refreshConsent: this.#refreshConsent,
      storageConsent: this.#storageConsent,
    });
  }

  set(kind: ConsentKind, granted: boolean): ConsentRecord {
    if (typeof granted !== 'boolean') {
      throw new TypeError(`Consent must be boolean for ${kind}.`);
    }

    if (kind === 'refreshConsent') {
      this.#refreshConsent = nextRecord(this.#refreshConsent, granted);
      return this.#refreshConsent;
    }

    this.#storageConsent = nextRecord(this.#storageConsent, granted);
    return this.#storageConsent;
  }

  grantRefreshConsent(): ConsentRecord {
    return this.set('refreshConsent', true);
  }

  revokeRefreshConsent(): ConsentRecord {
    return this.set('refreshConsent', false);
  }

  grantStorageConsent(): ConsentRecord {
    return this.set('storageConsent', true);
  }

  revokeStorageConsent(): ConsentRecord {
    return this.set('storageConsent', false);
  }

  async runLifecycleRefresh<TResult>(
    refresh: () => TResult | Promise<TResult>,
  ): Promise<OptionalRefreshResult<TResult>> {
    if (!this.#refreshConsent.granted) {
      return Object.freeze({ mode: 'local_only', value: undefined });
    }
    return Object.freeze({ mode: 'refreshed', value: await refresh() });
  }

  async runPersistentWrite<TResult>(
    persist: () => TResult | Promise<TResult>,
  ): Promise<OptionalPersistenceResult<TResult>> {
    if (!this.#storageConsent.granted) {
      return Object.freeze({ mode: 'memory_only', value: undefined });
    }
    return Object.freeze({ mode: 'persisted', value: await persist() });
  }
}

export function createConsentRepository(): ConsentRepository {
  return new ConsentRepository();
}
