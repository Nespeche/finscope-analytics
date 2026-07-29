# Glosario activo — v0.19.2

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

- **CIK:** identificador SEC autoritativo de un emisor, normalizado a 10 dígitos.
- **Company Facts:** endpoint SEC primario con hechos agregados por emisor.
- **Company Concept:** endpoint SEC de un taxonomy/tag; fallback selectivo, no fuente primaria.
- **Mapping exacto:** correspondencia aprobada y versionada entre un concepto canónico y un tag XBRL concreto; no implica inferencia.
- **Perfil contable:** allowlist explícita de conceptos y métricas para una clase de emisor/estándar.
- **Fact resolution state:** resultado de resolver un concepto en período/scope: resolved, absent, ambiguous o incompatible.
- **Coverage state:** cobertura agregada: complete, partial, missing o not_applicable.
- **Fundamental bundle:** inputs normalizados e inmutables del análisis fundamental.
- **Snapshot fundamental:** publicación atómica que enlaza un bundle y un análisis fundamental committed.
- **Overlay histórico de precio:** serie local opcional, independiente y versionada.
- **AST:** árbol de sintaxis abstracta JSON cerrado para reglas.
- **Fingerprint:** SHA-256 de una proyección JCS definida por allowlist.
- **Local operation issue:** error/estado producido fuera de HTTP; no es Problem Details.
- **Problem Details:** respuesta HTTP RFC 9457 del gateway.
- **Pointer:** referencia mutable y generacional al último record committed de un dominio.
- **Fixture:** vector de entrada y oráculo exacto usado para validar un contrato.
- **Valuación:** estimación de valor/precio objetivo; fuera del MVP.
- **Recomendación de inversión:** indicación buy/sell/hold o equivalente; fuera del MVP.
