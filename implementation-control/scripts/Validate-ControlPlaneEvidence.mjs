import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const [schemaPath, evidencePath] = process.argv.slice(2);
if (!schemaPath || !evidencePath) {
  console.error('Usage: node Validate-ControlPlaneEvidence.mjs <schema.json> <evidence.json>');
  process.exit(2);
}

try {
  const [schema, evidence] = await Promise.all([
    readFile(schemaPath, 'utf8').then(JSON.parse),
    readFile(evidencePath, 'utf8').then(JSON.parse),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  console.log('CONTROL_PLANE_EVIDENCE_SCHEMA_VALID');
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
}
