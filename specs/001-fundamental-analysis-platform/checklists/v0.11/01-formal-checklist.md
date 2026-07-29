# Checklist formal completo — v0.11

| ID | Resultado | Evidencia/conclusión |
|---|---|---|
| CHK-001 | PASS | ZIP y sidecar localizados; sufijos físicos documentados. |
| CHK-002 | PASS | SHA-256 calculado coincide: 20d44bfc3c8fc7df7a8fcb81555b682818747d0091d2cdf08cfbc9ebd04d2331. |
| CHK-003 | PASS | CRC íntegro; extracción independiente; baseline original no alterado. |
| CHK-004 | PASS | Raíz, metadata y manifest identifican v0.10. |
| CHK-005 | PASS | Manifest v0.10: 114/114 entradas verificadas. |
| CHK-006 | PASS | No hay secretos, API keys, builds, dependencias, temporales ni ZIP anidados. |
| CHK-007 | PASS | No existe `tasks.md`; `specdev-prompts/speckit.tasks.md` fue distinguido como infraestructura. |
| CHK-008 | PASS | Orden de lectura obligatorio cumplido y 115 archivos de baseline leídos. |
| CHK-009 | FAIL | V09-B01 no cierra: fingerprint/frescura de mercado no determinísticos. |
| CHK-010 | FAIL | V09-B02 no cierra: ValuationContext y derivaciones de deuda/EBITDA ambiguos. |
| CHK-011 | FAIL | V09-B03 no cierra: síntesis neutral/insufficient contradictoria. |
| CHK-012 | FAIL | V09-B04 no cierra: Problem Details no discriminado. |
| CHK-013 | FAIL | V09-B05 no cierra: ausencia de concepto/cache/calls y derivaciones incompletas. |
| CHK-014 | FAIL | V09-I01 no cierra. |
| CHK-015 | PASS | V09-I02 cierra: cinco metadatos corregidos. |
| CHK-016 | PASS | V09-I03 cierra: estado efectivo de policy determinístico. |
| CHK-017 | FAIL | V09-I04 no cierra. |
| CHK-018 | FAIL | V09-I05 no cierra. |
| CHK-019 | PASS | V09-M01 cierra: MIC requerido/nullable/fingerprinted. |
| CHK-020 | PASS | OpenAPI 3.1 parsea sintácticamente. |
| CHK-021 | PASS | 87 `$ref` resueltos; 0 rotos. |
| CHK-022 | PASS | 6 operationId de paths, todos únicos. |
| CHK-023 | PASS | 36 IDs de métricas, 12 reglas y 60 AC sin duplicados. |
| CHK-024 | PASS | 35 enlaces Markdown locales revisados; 0 rotos. |
| CHK-025 | FAIL | Consistencia semántica de enums/estados: alias de cobertura y combinaciones genéricas. |
| CHK-026 | FAIL | Required/nullable semántico: callsUsed>=1 contradice cache hit=0. |
| CHK-027 | FAIL | Entidades: SharesBasis/reasons no discriminados. |
| CHK-028 | PASS | 36 métricas revisadas. |
| CHK-029 | PASS | 12 reglas revisadas. |
| CHK-030 | PASS | 60 criterios revisados. |
| CHK-031 | PASS | Pesos 35+25+20+20=100 exacto. |
| CHK-032 | PASS | Bandas [0,40), [40,60), [60,80), [80,100] cubren dominio sin huecos. |
| CHK-033 | FAIL | Precedencia de síntesis contradice la cobertura matemática de bandas. |
| CHK-034 | PASS | Presupuesto SEC máximo numérico =10. |
| CHK-035 | PASS | `dei` está permitido para shares. |
| CHK-036 | PASS | No se amplió IFRS ni sectores fuera del MVP. |
| CHK-037 | PASS | No se generó código/SQL/migración/build/dependencia. |
| CHK-038 | PASS | `.specify`, normativos e históricos se conservaron byte a byte. |
| CHK-039 | PASS | Fuentes externas: no necesarias; registro vacío. |
| CHK-040 | FAIL | Gate de tareas rechazado por siete bloqueantes. |
| CHK-041 | PASS | ZIP final se empaqueta sin scripts temporales ni artefactos prohibidos. |
| CHK-042 | PENDIENTE EXTERNO | CRC y SHA del ZIP final se ejecutan después de cerrar el contenido; sidecar externo evita autorreferencia. |

## Dictamen

`NO APROBADO PARA TAREAS`. No se genera `tasks.md`.
