const sha256DigestBrand: unique symbol = Symbol('Sha256Digest');

export type Sha256Digest = `sha256:${string}` & {
  readonly [sha256DigestBrand]: true;
};

export const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const textEncoder = new TextEncoder();

function requireWebCrypto(): Crypto {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.subtle === undefined) {
    throw new Error('Web Crypto SHA-256 is unavailable in this runtime.');
  }
  return webCrypto;
}

function toBytes(input: string | Uint8Array): Uint8Array<ArrayBuffer> {
  return typeof input === 'string' ? textEncoder.encode(input) : Uint8Array.from(input);
}

export function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === 'string' && SHA256_DIGEST_PATTERN.test(value);
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const digest = await requireWebCrypto().subtle.digest('SHA-256', toBytes(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Digest(input: string | Uint8Array): Promise<Sha256Digest> {
  return `sha256:${await sha256Hex(input)}` as Sha256Digest;
}
