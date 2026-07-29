# Runtime schema validation contract

**Estado:** ACTIVE  
**Versión:** 1.0.0  
**Fecha:** 2026-07-22  
**Autoridad:** AUTH-036

## Alcance

Gobierna la compilación y validación runtime de los 26 JSON Schemas de producto Draft 2020-12. Los schemas operativos de `implementation-control/schemas/` se validan durante empaquetado, no forman parte del registry de producto de T012.

## Engine y registro

- Usar `Ajv2020` desde `ajv/dist/2020`.
- Registrar cada `$id` una sola vez y compilar el conjunto una sola vez por instancia del registry.
- Orden determinístico por `$id`; `$id` ausente/duplicado y `$ref` remoto/no empaquetado bloquean inicialización.
- Entradas externas son `unknown`; una validación fallida no entrega datos parciales tipados.
- Errores se normalizan en orden estable por `instancePath`, `schemaPath` y `keyword`.

## Política strict autorizada

```text
allErrors=true
strictSchema=true
strictNumbers=true
strictTuples=true
allowUnionTypes=false
strictRequired=false
strictTypes=false
validateFormats=true
```

`strictRequired=false` y `strictTypes=false` son excepciones de lint de compilación, no relajaciones del resultado de validación. Son necesarias porque los schemas activos usan composición Draft 2020-12 (`allOf`/`if`/`then`/`not` y `$ref`) donde `required` o `properties` pueden estar separados del `type`/definición local. `additionalProperties`/`unevaluatedProperties`, tipos efectivos y restricciones siguen aplicándose normalmente.

Cualquier otra advertencia strict es error. No usar `strict=false`, `validateSchema=false`, coerción, defaults automáticos, eliminación de propiedades ni formatos ignorados.

## Formatos

Sin dependencia adicional. Registrar validadores determinísticos empaquetados para:

- `date`: ISO `YYYY-MM-DD` con fecha calendario válida;
- `date-time`: RFC 3339 con zona explícita;
- `uri`: URI absoluta válida conforme al uso de los schemas.

Un formato desconocido bloquea compilación.

## Cierre T012

T012 solo puede completarse cuando:

1. los 26 schemas compilan una vez con esta política;
2. cada `$ref` resuelve localmente;
3. fixtures positivos pasan;
4. fixtures negativos y mutaciones de tipo/required/additionalProperties/formato fallan;
5. el test demuestra que las dos excepciones strict no permiten un payload inválido;
6. no se modifica un schema normativo para silenciar Ajv sin remediación autorizada.
