#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, pathlib, shutil, subprocess, tempfile, zipfile
from datetime import datetime, timezone

EXCLUDED_DIRS={'.git','node_modules','dist','build','coverage','.cache','.vite','.wrangler','playwright-report','test-results','.finscope-release','.finscope-evidence','.finscope-evidence-release','.finscope-redownload','__pycache__'}
EXCLUDED_NAMES={'PACKAGE_METADATA.json','PACKAGE_INVENTORY.json','FILE_MANIFEST.sha256','.DS_Store','Thumbs.db'}
EXCLUDED_SUFFIXES={'.zip','.pyc','.pyo','.log','.tmp','.bak'}
ROOT_NAME='FinScope_SDD2'

def digest(path:pathlib.Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def canonical_tree_hash(root:pathlib.Path)->tuple[int,str]:
 files=sorted((p for p in root.rglob('*') if p.is_file()), key=lambda p:p.relative_to(root).as_posix())
 h=hashlib.sha256()
 for p in files:
  rel=p.relative_to(root).as_posix().encode();h.update(rel+b'\0'+bytes.fromhex(digest(p))+b'\n')
 return len(files),h.hexdigest()

def include(path:pathlib.Path,root:pathlib.Path)->bool:
 rel=path.relative_to(root)
 if any(part in EXCLUDED_DIRS for part in rel.parts):return False
 if path.name in EXCLUDED_NAMES:return False
 if path.suffix.lower() in EXCLUDED_SUFFIXES:return False
 if path.is_symlink():raise RuntimeError(f'SYMLINK_FORBIDDEN:{rel.as_posix()}')
 return path.is_file()

def git_output(root:pathlib.Path,args:list[str])->str|None:
 try:return subprocess.check_output(['git','-C',str(root),*args],text=True,stderr=subprocess.DEVNULL).strip()
 except Exception:return None

def source_files(root:pathlib.Path)->list[pathlib.Path]:
 tracked=git_output(root,['ls-files','-z'])
 if tracked is not None:
  return sorted((p for rel in tracked.split('\0') if rel for p in [root/rel] if p.exists() and include(p,root)), key=lambda p:p.relative_to(root).as_posix())
 return sorted((p for p in root.rglob('*') if include(p,root)), key=lambda p:p.relative_to(root).as_posix())

def parse_gates(path:pathlib.Path)->dict[str,bool]:
 gates={}
 for line in path.read_text(encoding='utf-8').splitlines():
  if line.endswith('=true'):gates[line[:-5]]=True
  elif line.endswith('=false'):gates[line[:-6]]=False
 return gates

def main()->int:
 ap=argparse.ArgumentParser()
 ap.add_argument('--root',default='.')
 ap.add_argument('--output',required=True)
 ap.add_argument('--name',default='FS_v0.22.0_SDD2_governance_migration_candidate.zip')
 ap.add_argument('--status',choices=['CANDIDATE','COMPLETED'],default='CANDIDATE')
 ap.add_argument('--dry-run',action='store_true',help='Build and verify a non-published package; does not suppress file creation.')
 args=ap.parse_args()
 root=pathlib.Path(args.root).resolve();out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
 if not args.name.endswith('.zip') or '/' in args.name or '\\' in args.name:raise SystemExit('INVALID_ZIP_NAME')
 source_git_sha=git_output(root,['rev-parse','HEAD'])
 if args.status=='COMPLETED':
  if source_git_sha is None:raise SystemExit('COMPLETED_PACKAGE_REQUIRES_GIT_HEAD')
  dirty=git_output(root,['status','--porcelain','--untracked-files=no'])
  if dirty:raise SystemExit(f'GIT_TRACKED_TREE_DIRTY\n{dirty}')
 state=json.loads((root/'implementation-control/IMPLEMENTATION_STATE.json').read_text(encoding='utf-8'))
 baseline=json.loads((root/'implementation-control/BASELINE_LOCK.json').read_text(encoding='utf-8'))
 operation_bytes=(root/'implementation-control/OPERATION.json').read_bytes();operation=json.loads(operation_bytes)
 gates=parse_gates(root/'V0.21_PHASE_STATUS.md')
 with tempfile.TemporaryDirectory(prefix='finscope-sdd2-') as td:
  stage=pathlib.Path(td)/ROOT_NAME;stage.mkdir()
  sources=source_files(root)
  for p in sources:
   target=stage/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
  source_count,source_hash=canonical_tree_hash(stage)
  specify_count,specify_hash=canonical_tree_hash(stage/'.specify')
  tasks_hash=digest(stage/'specs/001-fundamental-analysis-platform/tasks.md')
  metadata={
   'schemaVersion':'2.0.0','project':'FinScope Analytics','packageId':args.name.removesuffix('.zip'),
   'packageVersion':'SDD2','generatedOn':datetime.now(timezone.utc).date().isoformat(),'result':args.status,
   'role':'CANDIDATE_NOT_ACTIVE' if args.status=='CANDIDATE' else 'COMPLETED_RELEASE_ASSET',
   'logicalZipName':args.name,'rootDirectory':ROOT_NAME,'sourceGitSha':source_git_sha,
   'operation':{'operationId':operation['operationId'],'type':operation['type'],'declarationSha256':hashlib.sha256(operation_bytes).hexdigest()},
   'implementationState':{
    'implementationStatus':state['implementationStatus'],'lastCompletedBatchId':state['lastCompletedBatchId'],
    'completedTaskBoundary':state['completedTaskIds'][-1] if state['completedTaskIds'] else None,
    'activeBatchId':state['activeBatchId'],'nextAuthorizedBatchId':state['nextAuthorizedBatchId'],
    'convergenceAuthorized':gates.get('convergenceAuthorized')
   },
   'operationInputBaseline':baseline['operationInput'],
   'sourceTree':{'fileCount':source_count,'sha256':source_hash},
   'specify':{'count':specify_count,'treeSha256':specify_hash},'tasksSha256':tasks_hash,
   'generatedFiles':['PACKAGE_METADATA.json','PACKAGE_INVENTORY.json','FILE_MANIFEST.sha256'],
   'exclusionPolicy':{'directories':sorted(EXCLUDED_DIRS),'names':sorted(EXCLUDED_NAMES),'suffixes':sorted(EXCLUDED_SUFFIXES)}
  }
  (stage/'PACKAGE_METADATA.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  content=sorted((p for p in stage.rglob('*') if p.is_file() and p.name not in {'PACKAGE_INVENTORY.json','FILE_MANIFEST.sha256'}), key=lambda p:p.relative_to(stage).as_posix())
  inventory=[];manifest=[]
  for p in content:
   rel=p.relative_to(stage).as_posix();d=digest(p);inventory.append({'path':rel,'size':p.stat().st_size,'sha256':d});manifest.append(f'{d}  {rel}')
  inv={'schemaVersion':'2.0.0','rootDirectory':ROOT_NAME,'fileCount':len(inventory),'files':inventory}
  (stage/'PACKAGE_INVENTORY.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  (stage/'FILE_MANIFEST.sha256').write_text('\n'.join(manifest)+'\n',encoding='utf-8')
  zip_path=out/args.name
  with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zf:
   for p in sorted(stage.rglob('*'), key=lambda p:p.relative_to(stage).as_posix()):
    if not p.is_file():continue
    arc=f'{ROOT_NAME}/{p.relative_to(stage).as_posix()}'
    info=zipfile.ZipInfo(arc,date_time=(2026,8,6,12,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100644&0xFFFF)<<16
    zf.writestr(info,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
  zip_hash=digest(zip_path);sidecar=out/f'{args.name}.sha256';sidecar.write_text(f'{zip_hash}  {args.name}\n',encoding='utf-8')
  print(json.dumps({'status':'PASS','dryRun':args.dry_run,'packageStatus':args.status,'zip':str(zip_path),'sidecar':str(sidecar),'sha256':zip_hash,'root':ROOT_NAME,'sourceFileCount':source_count,'inventoryFileCount':len(inventory),'sourceGitSha':source_git_sha,'operationId':operation['operationId'],'specifyTreeSha256':specify_hash,'tasksSha256':tasks_hash},indent=2))
 return 0
if __name__=='__main__':raise SystemExit(main())
