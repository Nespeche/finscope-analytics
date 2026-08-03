import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateSchemaSubset } from '../../implementation-control/scripts/GitHub-Common.mjs';

const schemaPath=join(process.cwd(),'implementation-control/schemas/github-validation-evidence.schema.json');
const schema=JSON.parse(await readFile(schemaPath,'utf8'));
const commandSchema={...schema.$defs.commandResult};
const commandResult=(required:boolean)=>({id:'probe',category:'contract',command:'true',required,status:'PASS',cwd:process.cwd(),startedAt:'2026-08-03T00:00:00.000Z',finishedAt:'2026-08-03T00:00:00.001Z',durationMs:1,exitCode:0,stdoutPath:'logs/probe.stdout.log',stderrPath:'logs/probe.stderr.log',stdoutSha256:'0'.repeat(64),stderrSha256:'0'.repeat(64),discovery:{required:false,discovered:0,passed:0,skipped:0,pending:0,valid:true},reason:null});
const dependencyFree=(candidate:unknown,target=commandSchema)=>{try{return validateSchemaSubset(target,candidate,'$',target,[]).length===0;}catch{return false;}};
const standard=(candidate:unknown,target=commandSchema)=>{try{return new Ajv2020({allErrors:true,strict:true}).compile(target)(candidate)===true;}catch{return false;}};

describe('GitHub evidence commandResult schema parity',()=>{
  const positives=[commandResult(true),commandResult(false)];
  const negatives=[
    (({required:_,...rest})=>rest)(commandResult(true)),
    {...commandResult(true),required:'true'},
    {...commandResult(true),unexpected:true},
    (({cwd:_,...rest})=>rest)(commandResult(true)),
  ];
  it.each(positives)('accepts valid required booleans with both validators',(candidate)=>{expect(dependencyFree(candidate)).toBe(true);expect(standard(candidate)).toBe(true);});
  it.each(negatives)('rejects invalid command results with both validators',(candidate)=>{expect(dependencyFree(candidate)).toBe(false);expect(standard(candidate)).toBe(false);});
});

describe('dependency-free local JSON Pointer resolution',()=>{
  it('resolves #/$defs and rejects invalid values below the reference',()=>{
    const target={$defs:{value:{type:'object',required:['ok'],properties:{ok:{type:'boolean'}},additionalProperties:false}},$ref:'#/$defs/value'};
    expect(dependencyFree({ok:true},target)).toBe(true);
    expect(dependencyFree({ok:'true'},target)).toBe(false);
  });
  it('resolves #/properties and decodes ~0 and ~1',()=>{
    const target={properties:{'slash/name':{properties:{'tilde~name':{type:'boolean'}},required:['tilde~name'],additionalProperties:false}},$ref:'#/properties/slash~1name/properties/tilde~0name'};
    expect(dependencyFree(true,target)).toBe(true);
  });
  it('fails closed for missing references and cycles',()=>{
    expect(dependencyFree(true,{$ref:'#/$defs/missing',$defs:{}})).toBe(false);
    expect(dependencyFree(true,{$ref:'#/$defs/a',$defs:{a:{$ref:'#/$defs/b'},b:{$ref:'#/$defs/a'}}})).toBe(false);
  });
});

describe('runner-shaped evidence exercises the complete commandResult reference',()=>{
  it('accepts a generated runner result and rejects a tampered copy in both validators',async()=>{
    const target={type:'array',items:{$ref:'#/$defs/commandResult'},$defs:schema.$defs};
    const generated=[{...commandResult(true)}];
    const artifactCopy=join(await mkdtemp(join(tmpdir(),'finscope-evidence-contract-')),'github-validation-evidence.json');
    await writeFile(artifactCopy,`${JSON.stringify(generated)}\n`,'utf8');
    const reread=JSON.parse(await readFile(artifactCopy,'utf8'));
    expect(dependencyFree(reread,target)).toBe(true); expect(standard(reread,target)).toBe(true);
    const tampered=[{...reread[0],unexpected:true}];
    expect(dependencyFree(tampered,target)).toBe(false); expect(standard(tampered,target)).toBe(false);
  });
});
