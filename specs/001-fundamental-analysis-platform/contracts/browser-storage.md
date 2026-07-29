# Persistencia local en navegador — v0.19.2

**Autoridades:** `browser-storage-contract.json` y `local-export-restore-contract.json`.

## Estrategia

IndexedDB opt-in con `storageConsent`; snapshots, bundles, analyses y overlays inmutables. Pointers se modifican solo por compare-and-swap dentro de la misma transacción y commit log.

## Atomicidad

Candidato → schemas/fingerprints → commit record → CAS pointer → commit. Cualquier error/cancelación aborta todo y conserva pointers previos. Precio y fundamental usan stores/pointers independientes.

## Exportación/restauración

Export genera un paquete JSON local versionado con hashes. Restore exige preview, consentimiento, compatibilidad, schemas, hashes y referencias válidos. Conflict policy por defecto es reject; reemplazo requiere elección posterior al preview. No hay writes parciales ni red; importar no concede refresh consent.

## Borrado

Borrar precio preserva fundamentales. Borrar todo exige confirmación y ofrece export previo; la transacción es atómica.

## Privacy, corruption and deletion v0.19.3

IndexedDB corruption or checksum mismatch quarantines the record and never advances an active pointer. Retention is user-controlled; delete is transactional and removes dependent pointers/commit records. Logs contain codes only. Restore performs preview, checksum, version and migration validation before an atomic write or complete rollback. Secrets and credentials are never persisted.
