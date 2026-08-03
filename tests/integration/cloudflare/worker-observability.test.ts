import { describe, expect, it } from 'vitest';
import { createWorkerRequestMetrics, serializeWorkerRequestMetrics } from '../../../workers/sec-gateway/src/observability';

describe('Worker observability', () => {
  it('records the required numeric boundary metrics and exactly one upstream request', () => {
    const metrics = createWorkerRequestMetrics({ cpuMilliseconds: 3.2, subrequestCount: 1, responseBytes: 4096, errorCode: null });
    expect(metrics).toEqual({ requestCount: 1, cpuMilliseconds: 3.2, subrequestCount: 1, responseBytes: 4096, errorCode: null });
  });

  it('serializes no URL, CIK, contact, payload, or financial values', () => {
    const serialized = serializeWorkerRequestMetrics(createWorkerRequestMetrics({ cpuMilliseconds: 1, subrequestCount: 1, responseBytes: 20, errorCode: 'provider_unavailable' }));
    expect(Object.keys(JSON.parse(serialized))).toEqual(['requestCount', 'cpuMilliseconds', 'subrequestCount', 'responseBytes', 'errorCode']);
    expect(serialized).not.toMatch(/@|cik|contact|payload|https?:/iu);
  });
});
