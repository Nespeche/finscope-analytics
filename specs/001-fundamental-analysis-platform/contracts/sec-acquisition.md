# Contrato de adquisición SEC — v0.19.2

**Autoridades:** `sec-acquisition-policy.json`, `cache-and-refresh-policy.json`, `sec-filing-fact-selection-policy.json`, `security-and-input-limits.json`.

## Orden y presupuesto

Cache → Submissions → Company Facts → mappings exactos → Company Concept selectivo. Máximo 14 llamadas externas incluyendo reintentos; concurrencia 1. Company Concept nunca se recorre por taxonomía completa.

## Forms y facts

10-K/Q, 20-F, 6-K, 40-F y amendments son elegibles bajo perfil/mapping/unidad/scope. 8-K/A es evidencia. Frames no selecciona. Duplicados, amendments, restatements y conflictos siguen precedencia cerrada; igualdad conflictiva queda ambigua.

## Fair access y límites

User-Agent/contacto obligatorios como variables futuras de despliegue. Request 20 s, operación 120 s, respuesta 64 MiB, 3 intentos y backoff 1/2/4 s con Retry-After hasta 30 s.

## Errores parciales

Budget agotado o provider failure con payload utilizable produce `partial`; no existe llamada 15. Payload inválido no se persiste. Live smoke es opcional; fixtures congelados son oráculo estable.
