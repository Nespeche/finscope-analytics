import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalTreeHash, readJson, root, run, setOutput } from './GitHub-Common.mjs';

const handoff=await readJson(join(root,'implementation-control/GITHUB_HANDOFF.json'));
const operation=handoff.operation??{};
const payloadMetaPath=join(root,`implementation-control/reports/${operation.id}_CLOSURE_PAYLOAD.json`);
const output=(applied,detail)=>Promise.all([setOutput('applied',String(applied)),setOutput('detail',detail)]);
if(operation.stage!=='closure') { await output(false,'CLOSURE_NOT_REQUESTED'); process.exit(0); }
let meta;
try{meta=await readJson(payloadMetaPath);}catch{await output(false,'CLOSURE_PAYLOAD_NOT_PRESENT');process.exit(0);}
if(meta.schemaVersion!=='1.0.0'||meta.operationId!==operation.id||meta.candidateSha!==handoff.candidate?.sha) throw new Error('CLOSURE_PAYLOAD_IDENTITY_MISMATCH');
if(meta.archiveFormat!=='tar.xz'||!Array.isArray(meta.partFiles)||meta.partFiles.length===0||!Array.isArray(meta.expectedFiles)||meta.expectedFiles.length===0) throw new Error('CLOSURE_PAYLOAD_METADATA_INVALID');
const base64Parts=[];
for(const rel of meta.partFiles){ if(!new RegExp(`^implementation-control/reports/${operation.id}_CLOSURE_PAYLOAD\\.part\\d+$`,'u').test(rel)) throw new Error(`CLOSURE_PAYLOAD_PART_PATH_INVALID:${rel}`); base64Parts.push((await readFile(join(root,rel),'utf8')).trim()); }
const archiveBytes=Buffer.from(base64Parts.join(''),'base64');
const digest=createHash('sha256').update(archiveBytes).digest('hex');
if(digest!==meta.archiveSha256) throw new Error(`CLOSURE_PAYLOAD_HASH_MISMATCH:${digest}`);
const work=await mkdtemp(join(tmpdir(),'finscope-closure-'));
try{
  const archive=join(work,'closure.tar.xz'); await writeFile(archive,archiveBytes);
  const list=await run(`tar -tJf "${archive}"`,{cwd:root}); if(list.exitCode!==0) throw new Error(`CLOSURE_PAYLOAD_LIST_FAILED:${list.stderr.toString('utf8')}`);
  const names=list.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean);
  if(names.some((name)=>name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||name.length===0)) throw new Error('CLOSURE_PAYLOAD_UNSAFE_PATH');
  const expected=[...meta.expectedFiles].sort(); const observed=[...names].sort();
  if(JSON.stringify(expected)!==JSON.stringify(observed)) throw new Error(`CLOSURE_PAYLOAD_FILE_SET_MISMATCH:${JSON.stringify(observed)}`);
  const extract=await run(`tar -xJf "${archive}" -C "${root}"`,{cwd:root}); if(extract.exitCode!==0) throw new Error(`CLOSURE_PAYLOAD_EXTRACT_FAILED:${extract.stderr.toString('utf8')}`);
  await rm(payloadMetaPath,{force:true}); for(const rel of meta.partFiles) await rm(join(root,rel),{force:true});
  const specify=await canonicalTreeHash(join(root,'.specify')); if(specify.count!==19||specify.sha256!==handoff.baseline.specifyTreeSha256) throw new Error(`SPECIFY_MISMATCH:${specify.count}:${specify.sha256}`);
  const aliasRoot=join(work,handoff.baseline.root.replace(/\/$/u,'')); await symlink(root,aliasRoot,'dir');
  const control=await run(`node implementation-control/scripts/Validate-ControlPlaneState.mjs "${aliasRoot}"`,{cwd:root});
  await writeFile(join(work,'control.stdout.log'),control.stdout); await writeFile(join(work,'control.stderr.log'),control.stderr);
  if(control.exitCode!==0) throw new Error(`CONTROL_PLANE_FAILED:${control.exitCode}:${control.stderr.toString('utf8')}`);
  const status=await run('git status --porcelain=v1',{cwd:root}); if(status.exitCode!==0) throw new Error('GIT_STATUS_FAILED');
  const changed=status.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean).map((line)=>line.slice(3));
  const batchEscaped=String(operation.id).replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
  const allow=[/^implementation-control\/GITHUB_HANDOFF\.json$/u,new RegExp(`^implementation-control/reports/${batchEscaped}_`,'u'),/^implementation-control\/CHANGE_LEDGER\.md$/u,/^implementation-control\/IMPLEMENTATION_STATE\.json$/u,/^implementation-control\/IMPLEMENTATION_BATCH_MAP\.(?:json|md)$/u,/^implementation-control\/TASK_SOURCE_LOCK\.json$/u,/^implementation-control\/batches\/B\d{2}\.json$/u,/^implementation-control\/AUTHORITY_MATRIX\.json$/u,/^DOCUMENTATION_INDEX\.md$/u,/^START_HERE_CHATGPT\.md$/u,/^PROJECT_CONTEXT\.md$/u,/^PACKAGE_METADATA\.json$/u,/^PACKAGE_INVENTORY\.json$/u,/^FILE_MANIFEST\.sha256$/u,/^specs\/001-fundamental-analysis-platform\/tasks\.md$/u];
  const denied=changed.filter((path)=>!allow.some((pattern)=>pattern.test(path))); if(denied.length) throw new Error(`CLOSURE_APPLY_ALLOWLIST_VIOLATION:${JSON.stringify(denied)}`);
  if(changed.length===0){await output(false,'CLOSURE_ALREADY_APPLIED');process.exit(0);}
  for(const command of ['git config user.name "FinScope GitHub Closure"','git config user.email "actions@users.noreply.github.com"','git add -A','git commit -m "chore: close B12 from authenticated evidence"']){const result=await run(command,{cwd:root});if(result.exitCode!==0)throw new Error(`CLOSURE_GIT_COMMAND_FAILED:${command}:${result.stderr.toString('utf8')}`);}
  const head=(await run('git rev-parse HEAD',{cwd:root})).stdout.toString('utf8').trim();
  const push=await run(`git push origin HEAD:refs/heads/${operation.branch}`,{cwd:root}); if(push.exitCode!==0) throw new Error(`CLOSURE_PUSH_FAILED:${push.stderr.toString('utf8')}`);
  await setOutput('closure_sha',head); await output(true,`CLOSURE_APPLIED:${head}`); console.log(JSON.stringify({result:'PASS',applied:true,closureSha:head,changedFiles:changed,controlPlane:'PASS'},null,2));
}finally{await rm(work,{recursive:true,force:true});}
