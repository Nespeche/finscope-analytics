# Development

> **Effective state:** this tree is the completed baseline `v0.21.3_B02_control_plane_hardening_completed`. B03 is pending, not started and is the only authorized next batch.

## Environment

Use Windows/VS Code, PowerShell, Node.js 22.12 or newer and npm 10.9 or newer. Before any batch implementation, verify the ZIP/sidecar and run the control-plane preflight.

The validated control-plane regression for this baseline was:

```powershell
npm ci
npm exec playwright install chromium
npm run validate:control-plane
npm run typecheck
npm run test:contract -- tests/contract/control-plane-integrity.test.ts tests/contract/test-discovery.test.ts tests/contract/schema-registry.test.ts
npm run test
npm run test:browser
npm run build
```

Do not use `npm audit fix --force`, approve install scripts silently, introduce paid services or place credentials in the package.

## Implement one batch

1. Verify ZIP, sidecar, manifest, inventory, metadata and `.specify`.
2. Run `npm run validate:control-plane`; stop on nonzero exit.
3. Read the gate, authority matrix, state, lock and active batch mirror.
4. Implement only B03 and its declared files/tests.
5. Run its exact `localValidation.commands`.
6. Close directly only when all commands pass. Otherwise emit a candidate and use `LOCAL_VALIDATION_PROTOCOL.md`.
7. Stop before B04.
