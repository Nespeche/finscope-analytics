# Orquestación de actualización incremental — v0.19.2

**Autoridad:** `cache-and-refresh-policy.json`

## Entradas UI

- apertura/reanudación;
- **Actualizar fundamentales**;
- `refreshConsent` independiente de `storageConsent`;
- cancelación.

## Política

1. App cerrada: ninguna ejecución en background.
2. Sin consentimiento: cargar local, sin red.
3. Fresh <6 h: sin red, salvo refresh manual.
4. Stale 6 h–<7 d: consultar Submissions y comparar novelty fingerprint.
5. Expired ≥7 d: intentar refresh; ante error conservar último snapshot válido.
6. Company Facts solo por novedad/cache miss/cambio de autoridad/manual forzado.
7. Company Concept solo fallback exacto y presupuestado.
8. Cancelación/fallo no publica candidatos ni altera pointers.
9. Timestamps operativos se excluyen de fingerprints.

## Idempotency and retry contract v0.19.3

Cada operación tiene `operationId` y `idempotencyKey` derivada de CIK, tipo de adquisición y versión de política. Un lock por CIK/tipo evita ejecución concurrente incompatible. Todo retry respeta `Retry-After`, el backoff 1/2/4 s, jitter acotado, presupuesto global y cancelación. Repetir una operación con la misma evidencia no crea snapshots, pointers ni commits duplicados. Un fallo conserva stale data válida, marca estado partial/error y solo publica resultados nuevos mediante commit atomic.
