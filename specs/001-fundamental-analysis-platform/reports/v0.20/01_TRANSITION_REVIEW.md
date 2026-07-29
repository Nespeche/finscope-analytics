# Informe de revisión de transición — v0.20

## Veredicto

`APPROVED_TASKS_READY_FOR_ANALYSIS`

El ZIP v0.19.3 coincide con su sidecar (`995b1b746374b70c17fc3baf483aade6ef9215a62ce3e47a1a6580e9b5d21d4d`), pasa CRC, tiene raíz única, 359 entradas y no contiene traversal, symlinks, secretos, temporales, dependencias ni archivos anidados. `.specify` se preservó byte por byte y `tasks.md` no existía al inicio.

## Versión y vigencia

v0.20 es la versión del paquete/fase. Spec, aclaración, research y plan conservan revisión normativa material v0.19.3 y declaran explícitamente esa distinción. v0.19.3 es baseline histórico inmediato; v0.19.2 y anteriores no tienen autoridad activa.

## Alcance

MVP **SEC-only, CIK-first**; Company Facts primario y Company Concept exacto. CNV, global no SEC, ETF y proveedores de precio quedan post-MVP. Precio CSV/manual es opcional. No existe ejecución con la aplicación cerrada.

## Arquitectura y Cloudflare

Svelte 5 SPA, TypeScript strict, Vite, decimal.js/HALF_EVEN, Web Worker tipado, IndexedDB opt-in, Pages, Worker SEC streaming y D1 mínimo. Pages Functions, KV, R2, Queues, Durable Objects y Cron no se usan.

Límites oficiales comprobados: Pages 20.000 archivos, 25 MiB/asset y 500 builds/mes; Workers Free 100.000 requests/día, 10 ms CPU, 128 MB, 50 subrequests y 3 MB gzip; D1 5 M reads/día, 100.000 writes/día, 5 GB, 500 MB/DB y 50 queries/invocación. Presupuestos: <500 assets, <=20 builds/mes, <=2.000 Worker requests/día, p95 CPU <=4 ms y D1 <=1% de reads/writes.

## Explicación de los 103 controles FAIL

No eran 103 problemas arquitectónicos independientes sino **103 aserciones de control**: 88 `MAJOR` y 15 `BLOCKER`. Distribución: WCAG=55, Cloudflare=13, seguridad=11, import/export/restore=9, datos financieros=5, frontend/testing=3, gobierno=2, actualización=2, autoridad=1, fórmulas=1 y SEC=1.

Los 55 criterios WCAG fallaron individualmente por una omisión transversal de linkage/justificación; los 13 controles Cloudflare por la ausencia de un único presupuesto formal. Los bloqueos arquitectónicos reales se concentraban en resolución exacta de autoridades, dos oráculos de fórmula y presupuesto Cloudflare. El resto medía el alcance repetido de omisiones documentales y de prueba.

## Problemas encontrados y corregidos en esta transición

- Ambigüedad entre versión del contenido y versión del paquete: corregida.
- Alcance potencialmente interpretable como CNV/global/proveedor de precio: cerrado como SEC-only.
- Árbol futuro y dependencias mínimas insuficientemente exactos: definidos en plan y tareas.
- Ausencia del límite Pages builds/month: corregida en presupuesto y schema.
- Índice/spec/aclaraciones retenían gates pre-tareas: sincronizados.
- AC-077 y su schema seguían autorizando el gate anterior: corregidos.
- Conteo 104→109, flags QA falsos y ocho tareas sin prueba directa: corregidos.

## QA de preparación y tareas

- Requisitos: **49/49**.
- AC: **84/84**.
- Componentes del plan: **10/10**.
- Fórmulas/vectores: **15/36**, con **15/15** oráculos disponibles recomputados.
- Schemas: **26/26** compilados; **16/16** instancias directas y fixtures SEC positivos/negativos conformes.
- Métricas/reglas: **24 fundamentales + 8 de precio + 9 insights**.
- Tareas: **109**, IDs únicos/secuenciales, dependencias previas, cero ciclos, paths exactos y pruebas asociadas.
- Resultado final: **0 BLOCKER, 0 FAIL, 0 BLOCKED**.

## Riesgos clasificados

- **Tarea obligatoria:** exactitud SEC/XBRL, determinismo, seguridad, WCAG, import/restore, cuotas y observabilidad.
- **Prueba obligatoria:** 49 requisitos, AC-001..084, schemas/fixtures, fórmulas y flujos E2E.
- **Riesgo runtime:** variación de payload SEC, CPU Worker, cuota diaria y compatibilidad IndexedDB; todos tienen degradación/tareas.
- **Post-MVP:** CNV, global no SEC, ETF, proveedor automático, background cerrado y valuación.
- **No aplicable:** KV, R2, Queues, Durable Objects, Cron y Pages Functions.

## Resultado de tareas

Se generaron **109 tareas** con cobertura 49/49 requisitos y 84/84 AC. No se implementó código.
