import Ajv2020 from 'ajv/dist/2020.js';
import { pathToFileURL } from 'node:url';
import { readJson } from './GitHub-Common.mjs';

export const AJV_IDENTITY='ajv@8.20.0/dist/2020';
export async function validateEvidenceWithAjv(schemaPath,documentPath) {
  const [schema,document]=await Promise.all([readJson(schemaPath),readJson(documentPath)]);
  const ajv=new Ajv2020({allErrors:true,strict:true});
  const validate=ajv.compile(schema);
  if(!validate(document)) throw new Error(`AJV_DRAFT_2020_12_INVALID:${ajv.errorsText(validate.errors,{separator:'|',dataVar:'$'})}`);
  return {validator:AJV_IDENTITY,draft:'2020-12',result:'PASS'};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [schemaPath,documentPath]=process.argv.slice(2);
  if(!schemaPath||!documentPath) throw new Error('USAGE: Validate-GitHubEvidenceSchema.mjs <schema> <document>');
  console.log(JSON.stringify(await validateEvidenceWithAjv(schemaPath,documentPath)));
}
