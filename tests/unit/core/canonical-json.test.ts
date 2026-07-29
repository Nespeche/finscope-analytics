import { describe, expect, it } from 'vitest';
import fingerprintTestVectors from '../../../specs/001-fundamental-analysis-platform/contracts/fingerprint-test-vectors.json';
import {
  canonicalizeJson,
  canonicalJsonBytes,
  type JsonValue,
} from '../../../src/core/canonical-json';
import { isSha256Digest, sha256Digest, sha256Hex } from '../../../src/core/sha256';

const RFC_8785_SAMPLE: JsonValue = {
  numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 1e-27],
  string: '€$\u000f\nA\'B"\\"/',
  literals: [null, true, false],
};

const RFC_8785_EXPECTED =
  '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\"/"}';

describe('RFC 8785 canonical JSON and SHA-256', () => {
  it('produces the exact RFC 8785 sample bytes', () => {
    const canonical = canonicalizeJson(RFC_8785_SAMPLE);
    expect(canonical).toBe(RFC_8785_EXPECTED);
    expect(new TextDecoder().decode(canonicalJsonBytes(RFC_8785_SAMPLE))).toBe(RFC_8785_EXPECTED);
  });

  it('sorts object properties by UTF-16 code units without locale or insertion-order dependence', () => {
    const first = { z: 1, a: 2, '\r': 3, '€': 4, '😀': 5 } as const;
    const second = { '😀': 5, '€': 4, '\r': 3, a: 2, z: 1 } as const;
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(canonicalizeJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('matches every sha256-prefixed official package fingerprint vector', async () => {
    expect(fingerprintTestVectors.positiveVectors).toHaveLength(4);
    for (const vector of fingerprintTestVectors.positiveVectors) {
      const bytes = canonicalJsonBytes(vector.input as JsonValue);
      expect(await sha256Digest(bytes), vector.id).toBe(vector.expectedFingerprint);
    }
  });

  it('uses exact lowercase SHA-256 prefix and digest rules', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const digest = await sha256Digest('abc');
    expect(digest).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(isSha256Digest(digest)).toBe(true);
    expect(isSha256Digest('SHA256:BA78')).toBe(false);
  });

  it('copies ArrayBufferLike-backed views into Web Crypto-compatible bytes', async () => {
    const shared = new SharedArrayBuffer(3);
    const bytes = new Uint8Array(shared);
    bytes.set([0x61, 0x62, 0x63]);

    expect(await sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('fails closed for non-JSON values, non-finite values, negative zero, cycles and invalid Unicode', () => {
    expect(() => canonicalizeJson({ value: Number.NaN } as unknown as JsonValue)).toThrow(/NaN/u);
    expect(() => canonicalizeJson({ value: Number.POSITIVE_INFINITY } as unknown as JsonValue))
      .toThrow(/infinities/u);
    expect(() => canonicalizeJson({ value: -0 } as unknown as JsonValue)).toThrow(/negative zero/u);
    expect(() => canonicalizeJson({ value: undefined } as unknown as JsonValue)).toThrow(/undefined/u);
    const sparse = new Array(1) as unknown as JsonValue;
    expect(() => canonicalizeJson(sparse)).toThrow(/sparse arrays/u);
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(() => canonicalizeJson(cycle as JsonValue)).toThrow(/cycles/u);
    expect(() => canonicalizeJson('\uD800' as JsonValue)).toThrow(/surrogate/u);
  });
});
