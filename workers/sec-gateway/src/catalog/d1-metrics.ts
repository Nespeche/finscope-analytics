import { FINSCOPE_CLOUDFLARE_BUDGET, assertWithinCloudflareBudget } from '../budget';

export interface D1QueryMetrics { readonly queryCount: number; readonly rowsRead: number; readonly rowsWritten: number; }

export class D1InvocationBudget {
  #queryCount = 0;
  #rowsRead = 0;
  #rowsWritten = 0;

  recordQuery(input: { readonly rowsRead?: number; readonly rowsWritten?: number }): D1QueryMetrics {
    const rowsRead = input.rowsRead ?? 0;
    const rowsWritten = input.rowsWritten ?? 0;
    if (![rowsRead, rowsWritten].every((value) => Number.isSafeInteger(value) && value >= 0)) {
      throw new TypeError('INVALID_D1_QUERY_METRICS');
    }
    this.#queryCount += 1;
    this.#rowsRead += rowsRead;
    this.#rowsWritten += rowsWritten;
    assertWithinCloudflareBudget('d1QueriesInvocation', this.#queryCount);
    return this.snapshot();
  }

  snapshot(): D1QueryMetrics {
    return Object.freeze({ queryCount: this.#queryCount, rowsRead: this.#rowsRead, rowsWritten: this.#rowsWritten });
  }
}

export function d1CanaryExceeded(input: { readonly rowsReadDay: number; readonly rowsWrittenDay: number; readonly storageBytes: number }): boolean {
  return input.rowsReadDay > FINSCOPE_CLOUDFLARE_BUDGET.d1RowsReadDay
    || input.rowsWrittenDay > FINSCOPE_CLOUDFLARE_BUDGET.d1RowsWrittenDay
    || input.storageBytes > FINSCOPE_CLOUDFLARE_BUDGET.d1StorageBytes;
}
