# Fixtures SEC congelados — v0.19.2

Estos archivos son extractos JSON acotados y congelados de estructuras oficiales de `data.sec.gov`, junto con un caso negativo derivado. Conservan nombres de campos y valores representativos necesarios para oráculos determinísticos sin incorporar un archivo masivo mutable.

- `manifest.json` registra URL, fecha y SHA-256.
- Los extractos oficiales no son modificados por el runtime.
- El caso `invalid-companyfacts-partial.json` está incompleto intencionalmente y debe fallar validación.
- Los smoke tests live son opcionales y nunca constituyen un gate de release.
