export const SEC_PAYLOAD_TEST_SIZES = Object.freeze({ small: 64 * 1024, submissions: 8 * 1024 * 1024, companyFactsMaximum: 64 * 1024 * 1024 });

export function chunkedJsonStream(payloadBytes: number, chunkBytes = 64 * 1024): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('{"data":"');
  const suffix = encoder.encode('"}');
  let emitted = 0;
  return new ReadableStream({
    pull(controller) {
      if (emitted === 0) controller.enqueue(prefix);
      const remaining = payloadBytes - emitted;
      if (remaining > 0) {
        const size = Math.min(chunkBytes, remaining);
        controller.enqueue(new Uint8Array(size).fill(97));
        emitted += size;
        return;
      }
      controller.enqueue(suffix);
      controller.close();
    },
  });
}
