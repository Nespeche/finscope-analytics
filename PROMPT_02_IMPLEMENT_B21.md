# Operación posterior — constituir e implementar B21 bajo SDD2

Usar únicamente después de que `sdd2-governance-migration` figure en GitHub como merged, tenga Release completed publicado, sus assets hayan sido descargados y reautenticados, y esa pareja sea la única activa en Fuentes.

Autentica Fuentes y consulta `main`. La declaración `OPERATION.json` del paquete anterior puede seguir describiendo la migración: su ciclo terminal se acredita exclusivamente con GitHub, no reescribiendo ese archivo.

Verifica:

- B01–B20 y T001–T089 `COMPLETED`;
- B21 y T090–T095 `PENDING`;
- `implementationAuthorized=true` y `convergenceAuthorized=false`;
- `.specify` y task locks válidos;
- merge SHA, Release, ZIP, sidecar, metadata y `sourceGitSha` de la migración autenticados;
- ausencia de otra rama/PR B21 vigente incompatible.

Constituye una nueva operación `BATCH_IMPLEMENTATION` para B21 desde el `main` exacto. En el mismo commit inicial de la rama:

1. reemplaza `OPERATION.json` por la declaración B21;
2. actualiza `BASELINE_LOCK.json.operationInput` con la pareja SDD2 completed activa y `expectedGitHubBase.mainSha` con el `main` actual;
3. cierra únicamente el finding `SDD2-MIGRATION-REQUIRED`;
4. retira B21 de `blockedBatchIds` y T090–T095 de `blockedTaskIds`;
5. deja B21 `PENDING` y `implementationStatus=READY` antes de implementar;
6. liga `operation.batch.batchId=B21`, task IDs exactos T090–T095 y SHA-256 real de `batches/B21.json`;
7. deriva allowlist, comandos, archivos y Done when exclusivamente de `B21.json` y `tasks.md`.

Después implementa solo B21 en esa rama/PR Draft y valida el HEAD exacto. No implementes B22+, no abras convergencia y no cambies `.specify`, tasks, requisitos, schemas, fixtures o tests fuera de autoridad. Ready, merge y Release requieren autorizaciones separadas. No encadenes el batch siguiente.
