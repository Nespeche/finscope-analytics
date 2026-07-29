# B03 — Informe de implementación y remediación r3 y hardening de rutas r4

## Identidad

- Baseline completado activo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_completed.zip`;
- SHA-256 del baseline: `64e41940d238f74d296793aaeb13f556b5d0cc3613f15723dc1788bd7f7b11a1`;
- Candidato r2 rechazado para promoción: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.4_B03_local_validation_candidate_r2.zip`;
- SHA-256 r2: `0efef1de32f4ebb0b79c1ff095947dabd9e60f364fb3c5716aa5a8e7532b5525`;
- Evidencia r2: `FinScope_local_evidence_B03_20260724-083533.zip`;
- SHA-256 evidencia: `2f2acef16e8b1cfd6acacf02c654f9f05720a7cb1b5e3bb95595a722a3d01ae4`;
- Candidato corregido: `FS_B03_r4.zip`;
- Lote: `B03 — Decimal, JCS, reloj, autoridades y mensajes`;
- Tareas: T011, T013, T014, T015 y T016;
- SHA-256 de `tasks.md`: `94ab42f057924057388aee2f27add34c4a35cc7d1bc0a76cce292e6a0f78be1c`.

## Verificación de evidencia r2

La evidencia es internamente coherente: sidecar y ZIP r2 coinciden, CRC y extracción son válidos, manifiesto/inventario/metadata pasan y los archivos objetivo permanecieron invariantes. El entorno fue Windows 10, PowerShell 7.6.4, Node v24.18.0 y npm 11.16.0.

| Comando | Resultado |
|---|---|
| `npm ci` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| unit aggregate B03 | FAIL, exit 1 |
| contrato B03 | NOT_RUN |
| regresión Vitest | NOT_RUN |
| build | NOT_RUN |

El PASS de typecheck cierra el defecto TS2345 de T013 corregido en r2.

## Causa raíz de B03-V002

`formula-vectors-negative.json` no es una lista exclusiva de tokens decimales inválidos. Contiene siete casos heterogéneos y declara la capa de fallo mediante `expectedFailure`:

- `DecimalString`: `NEG-TRAILING-ZEROS`, `NEG-EXPONENT`, `NEG-NEGATIVE-ZERO`;
- otras capas: `NEG-EXTRA-PROPERTY`, `NEG-UNKNOWN-REASON`, `NEG-UNKNOWN-FORMULA`, `NEG-INVALID-ARITY`.

El test r2 iteraba los siete casos y exigía que `instance.inputs[0]` no fuera un `DecimalString`. `NEG-EXTRA-PROPERTY` contiene correctamente `12.34`; su objeto es inválido por la propiedad `unexpected`, no por el decimal. La implementación de `isDecimalString` devolvió `true` de forma correcta y la expectativa de prueba fue la defectuosa.

No existe contradicción entre `decimal-library.md`, `common.schema.json`, el fixture y `tasks.md`. La contradicción estaba dentro del candidato: el test atribuyó a T011 un fallo perteneciente a la validación integral del vector, que ya está cubierto por el contrato de schemas de T012.

## Remediación r3

Se modificó exclusivamente `tests/unit/core/decimal.test.ts` dentro del alcance de T011:

```ts
const decimalFixtures = formulaVectorNegativeFixtures.cases.filter(
  (fixture) => fixture.expectedFailure === 'DecimalString',
);
```

Además, el test exige el conjunto exacto de tres IDs. Esto impide tanto incluir casos de otra capa como omitir silenciosamente un futuro vector decimal negativo. No se modificó ningún fixture, schema, contrato ni código productivo para hacer pasar la prueba.

## Por qué el baseline pasa y el candidato falla

El baseline B02 no contiene los archivos de implementación/prueba de B03. Su PASS acredita B01/B02 y el arnés previo, no código aún inexistente. `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` y `vitest.config.ts` son byte-idénticos entre baseline y r2. En el mismo entorno Node/npm que cerró B02, r2 pasó `npm ci` y typecheck. Por ello, la causa actual no es una dependencia ausente o desactualizada, sino lógica nueva de prueba incorporada por B03.

## Estado

| Tarea | Estado r4 | Evidencia actual |
|---|---|---|
| T011 | `IMPLEMENTED_PENDING_VALIDATION` | test semántico remediado en r3; ejecución r4 pendiente |
| T013 | `IMPLEMENTED_PENDING_VALIDATION` | typecheck PASS; unit JCS/SHA no ejecutado por bail |
| T014 | `IMPLEMENTED_PENDING_VALIDATION` | typecheck PASS; unit reloj no ejecutado |
| T015 | `IMPLEMENTED_PENDING_VALIDATION` | contrato no ejecutado |
| T016 | `IMPLEMENTED_PENDING_VALIDATION` | 5 unit tests PASS; aggregate/regresión/build pendientes |

B03 permanece `LOCAL_VALIDATION_REQUIRED`; `tasks.md` conserva casillas abiertas; B04 sigue `PENDING`; convergencia permanece cerrada.

## Riesgos de proceso detectados, no corregidos dentro de B03

1. El entorno de autoría no puede reproducir siempre `npm ci`; la primera ejecución real ocurre en el equipo delegado.
2. El wrapper es fail-fast y Vitest tiene `bail: 1`, por lo que una falla temprana impide conocer todos los defectos del candidato en una sola evidencia.
3. El `typecheck` productivo no incluye fuentes de tests; existe el hallazgo diferido `AUD-R6-004`.
4. `packageManager` declara npm 10.9.2, mientras la evidencia usa npm 11.16.0. No causó este fallo, pero el contrato de toolchain no se aplica de forma exacta.
5. `docs/development.md` conserva una narrativa de baseline B02/B03 pendiente; es un mirror obsoleto y no autoridad de estado.

Estas mejoras requieren una conversación separada de hardening del plano de control y regresión completa; no deben mezclarse con el cierre de T011–T016.

## Validación pendiente

Ejecutar los seis comandos normativos mediante `Invoke-FinScopeBatchValidation.ps1 -BatchId B03` mediante el flujo de ruta corta r4 desde `C:\FS\B03r4`. Solo seis PASS con exit code 0 permiten cerrar el lote.


## Hardening de rutas Windows r4

La extracción r3 no llegó al validador. Explorer devolvió `0x80010135` por la longitud acumulada y el bloque manual apuntó a una carpeta diferente de la ubicación real. r4 no cambia producto ni tests: usa `FS_B03_r4.zip`, `FS_B03_r4.zip.sha256`, la raíz `C:\FS\B03r4` y el lanzador externo `Run-FinScope-BatchValidation.ps1`. La ruta absoluta máxima prevista bajo esa raíz queda por debajo de la política de 220 caracteres.
