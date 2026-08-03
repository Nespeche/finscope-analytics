import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { canonicalTreeHash, evidenceFiles, now, parseDiscovery, readJson, root, run, setOutput, shaBytes, shaFile, validateJsonFile, writeJson, writeManifest } from './GitHub-Common.mjs';
import { loadAndResolveGitHubContext, validateRemediationScope } from './Resolve-GitHubContext.mjs';

const evidenceDir=join(root,'.finscope-evidence','validation'); await mkdir(join(evidenceDir,'logs'),{recursive:true});
const startedAt=now(); const handoff=await readJson(join(root,'implementation-control/GITHUB_HANDOFF.json')); const state=await readJson(join(root,'implementation-control/IMPLEMENTATION_STATE.json'));
const branch=process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||'local'; const headResult=await run('git rev-parse HEAD',{cwd:root}); const commitSha=headResult.exitCode===0?headResult.stdout.toString('utf8').trim().toLowerCase():'0'.repeat(40);
const commitSubject=(await run('git log -1 --pretty=%s',{cwd:root})).stdout.toString('utf8').trim();
let context; let contextFailure=null;
try { context=await loadAndResolveGitHubContext(root,branch); } catch(error) { contextFailure=error; }
const batchId=context?.batchId??state.activeBatchId; const batch=await readJson(join(root,`implementation-control/batches/${batchId}.json`));
const mode=context?.mode??'UNRESOLVED'; const releaseRemediation=mode==='RELEASE_REMEDIATION';
const selectedCommands=context?.commands??[]; const declaredCommands=selectedCommands;
const controlStdout=join(root,'.finscope-evidence/preflight/control-plane.stdout.log'); const controlStderr=join(root,'.finscope-evidence/preflight/control-plane.stderr.log');
const exitCodePath=join(root,'.finscope-evidence/preflight/control-plane.exit-code');
let controlExit=1; try{controlExit=Number((await readFile(exitCodePath,'utf8')).trim());}catch{}
const controlPlane={result:controlExit===0?'PASS':'FAIL',exitCode:controlExit,stdoutSha256:await shaFile(controlStdout),stderrSha256:await shaFile(controlStderr)};
let releaseBaseline; try{releaseBaseline=await readJson(join(root,'.finscope-evidence/preflight/release-baseline.json'));}catch(error){releaseBaseline={result:'FAIL',tag:context?.baselineTag??null,zipName:context?.baselineZipName??null,sidecarName:context?.baselineSidecarName??null,zipSha256:context?.baselineZipSha256??null,assetIds:[],root:context?.baselineRoot?.replace(/\/$/u,'')??null,failure:String(error)};}
const specifyActual=await canonicalTreeHash(join(root,'.specify')); const specify={count:specifyActual.count,sha256:specifyActual.sha256,expectedSha256:state.specifyTreeSha256,byteIdentical:specifyActual.count===19&&specifyActual.sha256===state.specifyTreeSha256};
const selfTests=[]; const record=(id,expected,observed,result)=>selfTests.push({id,expected,observed,result});
record('COLLECTION_NULL','reject','reject',Array.isArray(null)?'FAIL':'PASS'); record('COLLECTION_EMPTY_STRING','reject','reject',Array.isArray('')?'FAIL':'PASS');
for(const [id,value,expected] of [['COLLECTION_0',[],0],['COLLECTION_1',['a'],1],['COLLECTION_N',['a','b','c'],3]]) record(id,String(expected),String(value.length),value.length===expected?'PASS':'FAIL');
try{ const {assertSafeArchivePaths}=await import('./GitHub-Common.mjs'); assertSafeArchivePaths(['Root/../escape'],'Root'); record('NEGATIVE_TRAVERSAL','FAIL','PASS','FAIL'); }catch{ record('NEGATIVE_TRAVERSAL','FAIL','FAIL','PASS'); }
const empty=parseDiscovery('npm run test','regression','No test files found',''); record('NEGATIVE_EMPTY_SUITE','FAIL',empty.valid?'PASS':'FAIL',!empty.valid?'PASS':'FAIL');
const hashObserved=shaBytes(Buffer.from('actual'))===shaBytes(Buffer.from('expected')); record('NEGATIVE_HASH','FAIL',hashObserved?'PASS':'FAIL',!hashObserved?'PASS':'FAIL');
let primaryFailure=null; const executedCommands=[];
function fail(code,detail){ if(!primaryFailure) primaryFailure={code,detail}; }
let remediationScope=null;
if(context?.remediationMatched){
  const baseSha=process.env.GITHUB_BASE_SHA;
  if(!/^[0-9a-f]{40}$/iu.test(baseSha??'')) fail('MAINTENANCE_SCOPE_MISMATCH','GITHUB_BASE_SHA missing');
  else {
    const diff=await run(`git diff --name-only --diff-filter=ACMR ${baseSha}...${commitSha}`,{cwd:root});
    if(diff.exitCode!==0) fail('MAINTENANCE_SCOPE_MISMATCH',diff.stderr.toString('utf8'));
    else {
      try { remediationScope={id:context.remediationId,...validateRemediationScope(diff.stdout.toString('utf8').split(/\r?\n/u),context.allowedPaths)}; }
      catch(error){ fail(error.code??'MAINTENANCE_SCOPE_MISMATCH',error.message); remediationScope={id:context.remediationId,allowedPaths:context.allowedPaths,changedPaths:diff.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean),valid:false}; }
    }
  }
}
if(headResult.exitCode!==0||!/^[0-9a-f]{40}$/u.test(commitSha)) fail('CHECKED_OUT_SHA_INVALID',headResult.stderr.toString('utf8'));
if(contextFailure) fail(contextFailure.code??'BATCH_AUTHORITY_MISMATCH',contextFailure.message);
else if(controlPlane.result!=='PASS') fail('CONTROL_PLANE_FAILED',`exitCode=${controlExit}`);
else if(releaseBaseline.result!=='PASS') fail('BASELINE_RELEASE_FAILED',releaseBaseline.failure??'unknown');
else if(!specify.byteIdentical) fail('SPECIFY_MISMATCH',`${specify.count}/${specify.sha256}`);
else if(selfTests.some((item)=>item.result!=='PASS')) fail('OPERATION_SELF_TEST_FAILED',JSON.stringify(selfTests.filter((item)=>item.result!=='PASS')));
else if(releaseRemediation&&selectedCommands.length===0) fail('RELEASE_QUALIFICATION_COMMANDS_EMPTY','No release qualification commands were declared.');
else if(mode==='GH0_BOOTSTRAP'&&commitSubject.includes('[GH0_EXPECT_FAIL_HASH]')) fail('QUALIFICATION_INJECTED_HASH_MISMATCH','Intentional bootstrap failure selected by the candidate commit subject.');

for(const definition of selectedCommands){
  const logBase=join(evidenceDir,'logs',definition.id); const stdoutPath=`logs/${definition.id}.stdout.log`; const stderrPath=`logs/${definition.id}.stderr.log`;
  if(primaryFailure){ await writeFile(`${logBase}.stdout.log`,''); await writeFile(`${logBase}.stderr.log`,''); executedCommands.push({...definition,status:'NOT_RUN',cwd:root,startedAt:null,finishedAt:null,durationMs:null,exitCode:null,stdoutPath,stderrPath,stdoutSha256:shaBytes(Buffer.alloc(0)),stderrSha256:shaBytes(Buffer.alloc(0)),discovery:{required:false,discovered:0,passed:0,skipped:0,pending:0,valid:true},reason:`DEPENDENCY_FAILED:${primaryFailure.code}`}); continue; }
  const result=await run(definition.command,{cwd:root,env:{CI:'true',NO_COLOR:'1',FORCE_COLOR:'0'}}); await writeFile(`${logBase}.stdout.log`,result.stdout); await writeFile(`${logBase}.stderr.log`,result.stderr);
  const discovery=parseDiscovery(definition.command,definition.category,result.stdout.toString('utf8'),result.stderr.toString('utf8')); const status=result.exitCode===0&&discovery.valid?'PASS':'FAIL';
  executedCommands.push({...definition,status,cwd:root,startedAt:result.startedAt,finishedAt:result.finishedAt,durationMs:result.durationMs,exitCode:result.exitCode,stdoutPath,stderrPath,stdoutSha256:shaBytes(result.stdout),stderrSha256:shaBytes(result.stderr),discovery,reason:status==='PASS'?null:(result.exitCode!==0?`EXIT_${result.exitCode}`:'INVALID_DISCOVERY')});
  if(status==='FAIL') fail('COMMAND_FAILED',`${definition.id}:${result.exitCode}:${JSON.stringify(discovery)}`);
}
const evidencePath=join(evidenceDir,'github-validation-evidence.json');
selfTests.push({id:'EVIDENCE_SCHEMA_REREAD',expected:'PASS',observed:'PENDING',result:'PASS'});
const evidence={schemaVersion:'1.0.0',result:primaryFailure?'FAIL':'PASS',mode,repository:process.env.GITHUB_REPOSITORY||handoff.repository,branch,commitSha,runId:process.env.GITHUB_RUN_ID??null,activeBatchId:batchId,batchAuthoritySource:context?.batchAuthoritySource??null,baselineRole:context?.baselineRole??null,operationMatched:context?.operationMatched??false,remediationScope,browserRequired:releaseRemediation||mode==='BATCH_CLOSURE'||context?.remediationMatched?false:Boolean(batch.localValidation?.browserRequired),startedAt,finishedAt:now(),controlPlane,releaseBaseline:{result:releaseBaseline.result,tag:releaseBaseline.tag,zipName:releaseBaseline.zipName,sidecarName:releaseBaseline.sidecarName,zipSha256:releaseBaseline.zipSha256,assetIds:releaseBaseline.assetIds??[],root:releaseBaseline.root,failure:releaseBaseline.failure??null},specify,derivedBatchCommands:declaredCommands,executedCommands,selfTests,primaryFailure,files:[]};
await writeJson(evidencePath,evidence); evidence.files=(await evidenceFiles(evidenceDir)).filter((item)=>item.path!=='github-validation-evidence.json'); await writeJson(evidencePath,evidence);
try{ await validateJsonFile(join(root,'implementation-control/schemas/github-validation-evidence.schema.json'),evidencePath); selfTests.find((item)=>item.id==='EVIDENCE_SCHEMA_REREAD').observed='PASS'; evidence.selfTests=selfTests; await writeJson(evidencePath,evidence); await validateJsonFile(join(root,'implementation-control/schemas/github-validation-evidence.schema.json'),evidencePath); }catch(error){ const schemaTest=selfTests.find((item)=>item.id==='EVIDENCE_SCHEMA_REREAD'); schemaTest.observed='FAIL'; schemaTest.result='FAIL'; fail('EVIDENCE_SCHEMA_INVALID',String(error)); evidence.result='FAIL'; evidence.primaryFailure=primaryFailure; evidence.selfTests=selfTests; await writeJson(evidencePath,evidence); }
await writeManifest(evidenceDir); const artifactName=`finscope-github-validation-${commitSha.slice(0,12)}-${evidence.result==='PASS'?'PASS':'_FAILED'}`;
await setOutput('artifact_name',artifactName); await setOutput('evidence_dir',relative(root,evidenceDir).replaceAll('\\','/')); await setOutput('result',evidence.result);
console.log(JSON.stringify({artifactName,result:evidence.result,primaryFailure},null,2));
