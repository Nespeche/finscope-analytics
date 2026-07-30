import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

export const root = resolve(process.cwd());
export const posix = (value) => value.split(sep).join('/');
export const shaBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const now = () => new Date().toISOString();
export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export async function shaFile(path) { return shaBytes(await readFile(path)); }
export async function exists(path) { try { await stat(path); return true; } catch { return false; } }

export async function listFiles(directory, exclusions = []) {
  const base = resolve(directory); const output = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name); const rel = posix(relative(base, absolute));
      if (exclusions.some((item) => rel === item || rel.startsWith(`${item}/`))) continue;
      if (entry.isDirectory()) await visit(absolute); else if (entry.isFile()) output.push(absolute);
    }
  }
  await visit(base); return output.sort((a,b)=>posix(relative(base,a)).localeCompare(posix(relative(base,b)),'en'));
}

export async function canonicalTreeHash(directory) {
  const base = resolve(directory); const files = await listFiles(base); const parts=[];
  for (const absolute of files) { const rel=posix(relative(base,absolute)); const digest=createHash('sha256').update(await readFile(absolute)).digest(); parts.push(Buffer.from(rel),Buffer.from([0]),digest,Buffer.from([10])); }
  return { count: files.length, sha256: shaBytes(Buffer.concat(parts)) };
}

export function assertSafeArchivePaths(names, expectedRoot) {
  const normalized=[];
  for (const raw of names) {
    const name=String(raw).replaceAll('\\','/');
    if (!name || name.startsWith('/') || /^[A-Za-z]:\//u.test(name) || name.split('/').includes('..') || name.includes('\0')) throw new Error(`UNSAFE_ARCHIVE_PATH:${raw}`);
    normalized.push(name);
  }
  const roots=[...new Set(normalized.filter(Boolean).map((name)=>name.split('/')[0]))];
  if (roots.length!==1 || roots[0]!==expectedRoot.replace(/\/$/u,'')) throw new Error(`INVALID_ARCHIVE_ROOT:${roots.join(',')}`);
  const folded=new Set();
  for (const name of normalized) { const key=name.toLocaleLowerCase('en-US'); if (folded.has(key)) throw new Error(`CASE_FOLD_COLLISION:${name}`); folded.add(key); }
  return roots[0];
}

export async function run(command, options={}) {
  const startedAt=now(); const started=Date.now();
  return await new Promise((resolvePromise)=>{
    const child=spawn(command,{cwd:options.cwd??root,shell:true,env:{...process.env,...(options.env??{})},windowsHide:true});
    const out=[]; const err=[]; child.stdout.on('data',(d)=>out.push(Buffer.from(d))); child.stderr.on('data',(d)=>err.push(Buffer.from(d)));
    child.on('error',(error)=>{err.push(Buffer.from(String(error.stack??error))); resolvePromise({command,startedAt,finishedAt:now(),durationMs:Date.now()-started,exitCode:127,stdout:Buffer.concat(out),stderr:Buffer.concat(err)});});
    child.on('close',(code)=>resolvePromise({command,startedAt,finishedAt:now(),durationMs:Date.now()-started,exitCode:Number.isInteger(code)?code:1,stdout:Buffer.concat(out),stderr:Buffer.concat(err)}));
  });
}

export function parseDiscovery(command, category, stdout, stderr) {
  const text=`${stdout}\n${stderr}`.replace(/\u001b\[[0-9;]*m/gu,'');
  const installOnly=/\bplaywright\s+install\b/iu.test(command);
  const required=!installOnly && (/(?:vitest|playwright|\btest(?::|\b))/iu.test(command) || /(?:e2e|unit|integration|negative|regression|performance|contract)/iu.test(category));
  let passed=0, skipped=0, pending=0;
  for (const match of text.matchAll(/(?:Tests?\s+)?(\d+)\s+passed/giu)) passed=Math.max(passed,Number(match[1]));
  for (const match of text.matchAll(/(?:Tests?|Test Files)?\s*(\d+)\s+skipped/giu)) skipped=Math.max(skipped,Number(match[1]));
  for (const match of text.matchAll(/(?:Tests?|Test Files)?\s*(\d+)\s+(?:pending|todo|omitted)/giu)) pending=Math.max(pending,Number(match[1]));
  const explicitEmpty=/No (?:test files|tests) (?:found|were found)|0 tests? passed|Tests\s+0\s+passed/iu.test(text);
  const interrupted=/interrupted|cancelled|canceled|terminated/iu.test(text);
  const discovered=passed+skipped+pending;
  const valid=!required || (!explicitEmpty && !interrupted && discovered>0 && passed>0 && skipped===0 && pending===0);
  return { required, discovered, passed, skipped, pending, valid };
}

export async function writeManifest(directory, filename='EVIDENCE_MANIFEST.sha256') {
  const base=resolve(directory); const files=await listFiles(base,[filename]); const lines=[];
  for (const absolute of files) lines.push(`${await shaFile(absolute)}  ${posix(relative(base,absolute))}`);
  await writeFile(join(base,filename),`${lines.join('\n')}\n`,'utf8');
}

export async function verifyManifest(directory, filename='EVIDENCE_MANIFEST.sha256') {
  const base=resolve(directory); const lines=(await readFile(join(base,filename),'utf8')).trim().split(/\r?\n/u).filter(Boolean);
  for (const line of lines) { const match=/^([0-9a-f]{64})  (.+)$/u.exec(line); if(!match) throw new Error(`INVALID_MANIFEST_LINE:${line}`); const actual=await shaFile(join(base,match[2])); if(actual!==match[1]) throw new Error(`MANIFEST_HASH_MISMATCH:${match[2]}`); }
  return lines.length;
}

export function validateSchemaSubset(schema, value, path='$') {
  const errors=[]; const type=Array.isArray(value)?'array':value===null?'null':Number.isInteger(value)?'integer':typeof value;
  const types=schema.type?(Array.isArray(schema.type)?schema.type:[schema.type]):[];
  if(types.length && !types.includes(type) && !(type==='integer'&&types.includes('number'))) return [`${path}:type=${type}`];
  if(Object.hasOwn(schema,'const') && JSON.stringify(value)!==JSON.stringify(schema.const)) errors.push(`${path}:const`);
  if(schema.enum && !schema.enum.some((item)=>JSON.stringify(item)===JSON.stringify(value))) errors.push(`${path}:enum`);
  if(typeof value==='string'){ if(schema.minLength&&value.length<schema.minLength) errors.push(`${path}:minLength`); if(schema.pattern&&!new RegExp(schema.pattern,'u').test(value)) errors.push(`${path}:pattern`); }
  if(Array.isArray(value)){ if(schema.minItems&&value.length<schema.minItems) errors.push(`${path}:minItems`); if(schema.items) value.forEach((item,index)=>errors.push(...validateSchemaSubset(schema.items,item,`${path}/${index}`))); }
  if(value&&typeof value==='object'&&!Array.isArray(value)){ const props=schema.properties??{}; for(const required of schema.required??[]) if(!Object.hasOwn(value,required)) errors.push(`${path}:missing:${required}`); for(const [key,child] of Object.entries(props)) if(Object.hasOwn(value,key)) errors.push(...validateSchemaSubset(child,value[key],`${path}/${key}`)); if(schema.additionalProperties===false) for(const key of Object.keys(value)) if(!Object.hasOwn(props,key)) errors.push(`${path}:additional:${key}`); }
  return errors;
}

export async function validateJsonFile(schemaPath, documentPath) {
  const [schema,document]=await Promise.all([readJson(schemaPath),readJson(documentPath)]); const errors=validateSchemaSubset(schema,document); if(errors.length) throw new Error(`SCHEMA_INVALID:${errors.slice(0,20).join('|')}`); return true;
}

export async function evidenceFiles(directory) {
  const base=resolve(directory); const files=await listFiles(base); const output=[];
  for(const absolute of files) output.push({path:posix(relative(base,absolute)),sha256:await shaFile(absolute),sizeBytes:(await stat(absolute)).size}); return output;
}

export function setOutput(name,value){ const path=process.env.GITHUB_OUTPUT; if(path) return writeFile(path,`${name}=${String(value)}\n`,{encoding:'utf8',flag:'a'}); return Promise.resolve(); }
