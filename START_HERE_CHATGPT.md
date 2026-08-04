# START HERE — FinScope Analytics B21 completado, recuperación de promoción activa

El repositorio contiene B21 y T001–T095 completados, pero todavía no representa
un nuevo baseline de Fuentes. El único baseline completed autenticado sigue
siendo B20:

- tag: `v0.21.25-B20-completed`;
- ZIP: `FS_v0.21.25_B20_completed.zip`;
- SHA-256: `c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`.

El Release histórico `v0.21.26-B21-completed` está rechazado y no debe
reutilizarse, sobrescribirse ni eliminarse. La identidad de reemplazo prevista
es `v0.21.27-B21-completed-r2` con `FS_v0.21.27_B21_completed_r2.zip` y
su sidecar.

Está activo el gate extraordinario documentado en
`implementation-control/reports/B21_RELEASE_PROMOTION_RECOVERY_GATE.md`.
La remediación debe producir un nuevo candidato exact-head con todos sus
comandos PASS y después un cierre nuevo autorizado.

B22 permanece `PENDING`, pero no puede implementarse hasta publicar y
reautenticar el nuevo Release, reemplazar Fuentes y comprobar
`release.pending=false`. `convergenceAuthorized=false`; no iniciar B22,
lotes posteriores ni convergencia.
