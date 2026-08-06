#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, pathlib, re, stat, unicodedata, zipfile

PROHIBITED_PARTS={'.git','node_modules','dist','build','coverage','.cache','.vite','.wrangler','playwright-report','test-results','.finscope-release','.finscope-evidence','.finscope-evidence-release','.finscope-redownload','__pycache__'}
GENERATED={'PACKAGE_METADATA.json','PACKAGE_INVENTORY.json','FILE_MANIFEST.sha256'}
def sha_bytes(b:bytes)->str:return hashlib.sha256(b).hexdigest()
def sha_file(p:pathlib.Path)->str:
 h=hashlib.sha256()
 with p.open('rb') as f:
  for c in iter(lambda:f.read(1024*1024),b''):h.update(c)
 return h.hexdigest()
def tree_hash(zf:zipfile.ZipFile,root:str,prefix:str)->tuple[int,str]:
 names=sorted(n for n in zf.namelist() if n.startswith(f'{root}/{prefix}/') and not n.endswith('/'))
 h=hashlib.sha256()
 for n in names:
  rel=n[len(root)+1+len(prefix)+1:];h.update(rel.encode()+b'\0'+bytes.fromhex(sha_bytes(zf.read(n)))+b'\n')
 return len(names),h.hexdigest()
def source_tree_hash(zf:zipfile.ZipFile,root:str)->tuple[int,str]:
 names=sorted(n for n in zf.namelist() if not n.endswith('/') and pathlib.PurePosixPath(n).name not in GENERATED)
 h=hashlib.sha256()
 for n in names:
  rel=n[len(root)+1:];h.update(rel.encode()+b'\0'+bytes.fromhex(sha_bytes(zf.read(n)))+b'\n')
 return len(names),h.hexdigest()

def main()->int:
 ap=argparse.ArgumentParser();ap.add_argument('--zip',required=True);ap.add_argument('--sidecar',required=True)
 ap.add_argument('--expected-status',choices=['CANDIDATE','COMPLETED']);ap.add_argument('--expected-git-sha');ap.add_argument('--expected-operation-id')
 args=ap.parse_args();zp=pathlib.Path(args.zip);sp=pathlib.Path(args.sidecar);issues=[];checks=[]
 def ck(i,c,d):checks.append({'id':i,'status':'PASS' if c else 'FAIL','detail':d});issues.extend([] if c else [{'id':i,'detail':d}])
 line=sp.read_text(encoding='utf-8').strip();m=re.fullmatch(r'([0-9a-fA-F]{64})\s+[* ]?(.+\.zip)',line)
 ck('SIDECAR_FORMAT',bool(m),line);expected=m.group(1).lower() if m else '';logical=m.group(2) if m else ''
 actual=sha_file(zp);ck('ZIP_SHA256',actual==expected,f'{actual}/{expected}');ck('TRANSPORT_ALIAS_TOLERATED',logical.endswith('.zip'),f'physical={zp.name};logical={logical}')
 with zipfile.ZipFile(zp) as zf:
  bad=zf.testzip();ck('CRC',bad is None,str(bad));names=zf.namelist();files=[n for n in names if not n.endswith('/')]
  ck('NO_DUPLICATE_ENTRIES',len(names)==len(set(names)),f'{len(names)}/{len(set(names))}')
  roots={n.split('/')[0] for n in names if n};ck('SINGLE_ROOT',len(roots)==1,str(roots));root=next(iter(roots)) if len(roots)==1 else ''
  unsafe=[];symlinks=[];nested=[];prohibited=[];temporaries=[];secret_hits=[];utf8_fail=[];json_fail=[];fold={};unicode={}
  for info in zf.infolist():
   n=info.filename
   if n.startswith('/') or re.match(r'^[A-Za-z]:',n) or '..' in pathlib.PurePosixPath(n).parts:unsafe.append(n)
   mode=(info.external_attr>>16)&0xFFFF
   if stat.S_ISLNK(mode):symlinks.append(n)
   if not n.endswith('/') and pathlib.PurePosixPath(n).suffix.lower()=='.zip':nested.append(n)
   rel=n.split('/')[1:]
   if any(p in PROHIBITED_PARTS for p in rel):prohibited.append(n)
   base=pathlib.PurePosixPath(n).name
   if base in {'.env','.env.local','.env.production','.DS_Store','Thumbs.db'} or base.endswith(('.tmp','.bak','.swp','~','.pyc','.pyo')):temporaries.append(n)
   if not n.endswith('/') and info.file_size<=2_000_000:
    data=zf.read(n)
    if pathlib.PurePosixPath(n).suffix.lower() in {'.json','.md','.txt','.ts','.svelte','.mjs','.py','.ps1','.yml','.yaml','.html','.css','.jsonc'}:
     try:text=data.decode('utf-8')
     except UnicodeDecodeError:utf8_fail.append(n);text=''
     if text:
      for pattern in [r'-----BEGIN [A-Z ]*PRIVATE KEY-----',r'\bgh[pousr]_[A-Za-z0-9]{36,}\b',r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b',r'\bAKIA[0-9A-Z]{16}\b']:
       if re.search(pattern,text):secret_hits.append(n);break
      if pathlib.PurePosixPath(n).suffix.lower()=='.json':
       try:json.loads(text)
       except Exception:json_fail.append(n)
   k=n.casefold();fold.setdefault(k,[]).append(n);u=unicodedata.normalize('NFC',n).casefold();unicode.setdefault(u,[]).append(n)
  collisions=[v for v in fold.values() if len(v)>1];uc=[v for v in unicode.values() if len(v)>1]
  ck('SAFE_PATHS',not unsafe,str(unsafe[:5]));ck('NO_SYMLINKS',not symlinks,str(symlinks[:5]));ck('NO_NESTED_ZIPS',not nested,str(nested[:5]));ck('NO_PROHIBITED_PATHS',not prohibited,str(prohibited[:5]));ck('NO_TEMPORARY_FILES',not temporaries,str(temporaries[:5]));ck('NO_SECRET_PATTERNS',not secret_hits,str(secret_hits[:5]));ck('UTF8_TEXT',not utf8_fail,str(utf8_fail[:5]));ck('JSON_VALID',not json_fail,str(json_fail[:5]));ck('NO_CASE_COLLISIONS',not collisions,str(collisions[:3]));ck('NO_UNICODE_COLLISIONS',not uc,str(uc[:3]))
  required=[f'{root}/PACKAGE_METADATA.json',f'{root}/PACKAGE_INVENTORY.json',f'{root}/FILE_MANIFEST.sha256'];ck('GENERATED_FILES_PRESENT',all(n in names for n in required),str(required))
  metadata=json.loads(zf.read(required[0]));inventory=json.loads(zf.read(required[1]));manifest_text=zf.read(required[2]).decode('utf-8')
  ck('METADATA_SCHEMA_VERSION',metadata.get('schemaVersion')=='2.0.0',str(metadata.get('schemaVersion')));ck('ROOT_BINDING',metadata.get('rootDirectory')==root,f"{metadata.get('rootDirectory')}/{root}");ck('LOGICAL_NAME_BINDING',metadata.get('logicalZipName')==logical,f"{metadata.get('logicalZipName')}/{logical}")
  if args.expected_status:ck('EXPECTED_STATUS',metadata.get('result')==args.expected_status,f"{metadata.get('result')}/{args.expected_status}")
  if args.expected_git_sha:ck('EXPECTED_GIT_SHA',metadata.get('sourceGitSha')==args.expected_git_sha,f"{metadata.get('sourceGitSha')}/{args.expected_git_sha}")
  if args.expected_operation_id:ck('EXPECTED_OPERATION_ID',metadata.get('operation',{}).get('operationId')==args.expected_operation_id,f"{metadata.get('operation',{}).get('operationId')}/{args.expected_operation_id}")
  ck('SOURCE_GIT_SHA_FORMAT',metadata.get('sourceGitSha') is None or bool(re.fullmatch(r'[0-9a-f]{40}',metadata.get('sourceGitSha',''))),str(metadata.get('sourceGitSha')))
  manifest={line.split('  ',1)[1]:line.split('  ',1)[0] for line in manifest_text.splitlines() if '  ' in line};inv={i['path']:i for i in inventory['files']}
  content={n[len(root)+1:]:n for n in files if n not in required[1:]}
  ck('MANIFEST_COVERAGE',set(manifest)==set(content),f'{len(manifest)}/{len(content)}');ck('INVENTORY_COVERAGE',set(inv)==set(content),f'{len(inv)}/{len(content)}');ck('INVENTORY_COUNT',inventory.get('fileCount')==len(inv),f"{inventory.get('fileCount')}/{len(inv)}");ck('INVENTORY_ROOT',inventory.get('rootDirectory')==root,f"{inventory.get('rootDirectory')}/{root}")
  mismatches=[]
  for rel,n in content.items():
   data=zf.read(n);d=sha_bytes(data)
   if manifest.get(rel)!=d or inv.get(rel,{}).get('sha256')!=d or inv.get(rel,{}).get('size')!=len(data):mismatches.append(rel)
  ck('CONTENT_HASHES',not mismatches,str(mismatches[:5]))
  sc,sh=tree_hash(zf,root,'.specify');ck('SPECIFY_COUNT',sc==19,str(sc));ck('SPECIFY_HASH',sh==metadata.get('specify',{}).get('treeSha256'),f"{sh}/{metadata.get('specify',{}).get('treeSha256')}")
  tasks=f'{root}/specs/001-fundamental-analysis-platform/tasks.md';th=sha_bytes(zf.read(tasks));ck('TASKS_HASH',th==metadata.get('tasksSha256'),f"{th}/{metadata.get('tasksSha256')}")
  source_count,source_hash=source_tree_hash(zf,root);ck('SOURCE_TREE_COUNT',source_count==metadata.get('sourceTree',{}).get('fileCount'),f"{source_count}/{metadata.get('sourceTree',{}).get('fileCount')}");ck('SOURCE_TREE_HASH',source_hash==metadata.get('sourceTree',{}).get('sha256'),f"{source_hash}/{metadata.get('sourceTree',{}).get('sha256')}")
  op_path=f'{root}/implementation-control/OPERATION.json';op_bytes=zf.read(op_path);op=json.loads(op_bytes);ck('OPERATION_HASH',sha_bytes(op_bytes)==metadata.get('operation',{}).get('declarationSha256'),f"{sha_bytes(op_bytes)}/{metadata.get('operation',{}).get('declarationSha256')}");ck('OPERATION_ID_MATCH',op.get('operationId')==metadata.get('operation',{}).get('operationId'),f"{op.get('operationId')}/{metadata.get('operation',{}).get('operationId')}")
  lock=json.loads(zf.read(f'{root}/implementation-control/BASELINE_LOCK.json'));ck('INPUT_BASELINE_MATCH',lock.get('operationInput')==metadata.get('operationInputBaseline'),'BASELINE_LOCK.operationInput/PACKAGE_METADATA.operationInputBaseline')
 result={'status':'PASS' if not issues else 'FAIL','zip':str(zp),'logicalZipName':logical,'sha256':actual,'root':root,'fileCount':len(files),'checkCount':len(checks),'passCount':sum(c['status']=='PASS' for c in checks),'failCount':len(issues),'checks':checks,'issues':issues}
 print(json.dumps(result,ensure_ascii=False,indent=2));return 0 if not issues else 1
if __name__=='__main__':raise SystemExit(main())
