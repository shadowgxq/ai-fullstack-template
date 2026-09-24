"""Local integrity, snapshots and recoverable writes. Not an identity/ACL boundary."""
from __future__ import annotations
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
import uuid
import yaml
from manager_schema import Invalid, parse, require, validate, select_next
from plan_inputs import resolve_inputs

SKIP_PARTS = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', 'dist', 'build', 'coverage'}
PROTECTED = ('manager', 'openspec', 'docs', '.codex', '.claude', '.github', 'AGENTS.md', 'CLAUDE.md')

def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return uuid.uuid4().hex
def digest(data):
    if not isinstance(data, bytes): data = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str).encode()
    return hashlib.sha256(data).hexdigest()
def envelope(data): return {'data': data, 'sha256': digest(data)}
def decode(text):
    try: obj = json.loads(text)
    except (ValueError, TypeError) as exc: raise Invalid('unreadable runtime record') from exc
    require(isinstance(obj, dict) and 'data' in obj and obj.get('sha256') == digest(obj['data']), 'runtime record integrity mismatch')
    return obj['data']
def encoded(data): return (json.dumps(envelope(data), ensure_ascii=False, indent=2, default=str)+'\n').encode()
def beneath(a, b): return b == '.' or a == b or a.startswith(b.rstrip('/') + '/')
def overlap(a, b): return beneath(a, b) or beneath(b, a)
def rel(value):
    require(isinstance(value, str) and bool(value.strip()), 'nonempty relative path required')
    require('\\' not in value and ':' not in value and not any(x in value for x in '*?[]\x00'), f'unsupported path {value!r}')
    path = PurePosixPath(value)
    require(not path.is_absolute() and '..' not in path.parts, f'path escapes workspace: {value}')
    return str(path)
def safe(root, value):
    key = rel(value); path = root / key
    current = root
    for part in PurePosixPath(key).parts:
        current = current / part
        require(not current.is_symlink(), f'symlink not allowed: {key}')
    require(path.resolve().is_relative_to(root.resolve()), f'path escapes workspace: {key}')
    return path

def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.manager-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data); handle.flush(); os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

@contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as handle:
        try:
            if os.name == 'nt':
                import msvcrt
                if path.stat().st_size == 0: handle.write(b'0'); handle.flush()
                handle.seek(0); msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise Invalid('another Manager control operation is running; do not delete its lock') from exc
        try: yield
        finally:
            if os.name == 'nt':
                handle.seek(0); msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else: fcntl.flock(handle, fcntl.LOCK_UN)

class Store:
    def __init__(self, plan_path, root=None):
        original = Path(plan_path).absolute()
        self.root = Path(root).resolve() if root else (original.parent.parent if original.parent.name == 'manager' else original.parent).resolve()
        require(original.is_relative_to(self.root), 'plan outside project root')
        self.plan_rel = str(original.relative_to(self.root))
        self.path = self.file(self.plan_rel)
        self.runtime = self.file('manager/runtime')
        self.state_path = self.file('manager/runtime/state.json')
        self.journal = self.file('manager/runtime/transaction.json')
        self.plan = None; self.state = None; self.before_plan = None; self.before_state = None
    def file(self, path):
        path = str(path)
        if Path(path).is_absolute():
            require(Path(path).is_relative_to(self.root), 'external file not permitted')
            path = str(Path(path).relative_to(self.root))
        return safe(self.root, path)
    def recover(self):
        if not self.journal.exists(): return
        data = decode(self.journal.read_text())
        for row in data['writes']:
            p = self.file(row['path']); existing = digest(p.read_bytes()) if p.exists() else None
            require(existing in (row['before'], digest(bytes.fromhex(row['hex']))), 'transaction conflict; preserve files and reconcile manually')
        for row in data['writes']: atomic(self.file(row['path']), bytes.fromhex(row['hex']))
        self.journal.unlink()
    def load(self, allow_empty=False, migration_id=None):
        self.before_plan = self.path.read_bytes() if self.path.exists() else None
        require(allow_empty or self.before_plan is not None, f'missing plan: {self.path}')
        self.plan = parse(self.before_plan.decode()) if self.before_plan else {'version':2, 'requirements':[], 'openspec':[], 'batches':[]}
        self.before_state = self.state_path.read_bytes() if self.state_path.exists() else None
        self.state = decode(self.before_state.decode()) if self.before_state else {'version':2, 'approvals':{}, 'reviews':{}, 'gates':{}, 'starts':{}, 'claims':{}, 'repairs':{}, 'repair_counts':{}, 'sessions':{}, 'completed':{}, 'tickets':{}, 'milestones':{}, 'seal':{}}
        require(isinstance(self.state, dict) and self.state.get('version') == 2, 'unsupported runtime version')
        for key in ('approvals','reviews','gates','starts','claims','repairs','repair_counts','sessions','completed','tickets','milestones','seal'):
            require(isinstance(self.state.get(key),dict), f'invalid runtime collection: {key}')
        completed = self.valid_completions() | ({migration_id} if migration_id else set())
        errors, _ = validate(self.plan, completed_ids=completed)
        require(not errors, '; '.join(errors))
    def commit(self, extra=None):
        require((self.path.read_bytes() if self.path.exists() else None) == self.before_plan, 'plan changed concurrently')
        require((self.state_path.read_bytes() if self.state_path.exists() else None) == self.before_state, 'runtime changed concurrently')
        # Maintain the derived cursor only when the plan actually changes.
        same_plan = self.before_plan is not None and parse(self.before_plan.decode()) == self.plan
        if not same_plan:
            selected=select_next(self.plan)['selected']
            self.plan['current']={'batch':selected['batch'],'wave':selected['wave']} if selected else {}
        plan_bytes = yaml.safe_dump(self.plan, allow_unicode=True, sort_keys=False).encode()
        writes = {} if same_plan else {self.plan_rel: plan_bytes}
        writes['manager/runtime/state.json'] = encoded(self.state)
        for key, val in (extra or {}).items():
            path = str(self.file(key).relative_to(self.root))
            require(path not in writes, 'duplicate transaction destination')
            writes[path] = val
        rows = []
        for path, data in writes.items():
            p = self.file(path)
            rows.append({'path': path, 'before': digest(p.read_bytes()) if p.exists() else None, 'hex': data.hex()})
        atomic(self.journal, encoded({'writes':rows, 'at':now()}))
        self.recover()
        self.before_plan = self.path.read_bytes(); self.before_state = self.state_path.read_bytes()
    def entry(self, cid):
        found = next((e for e in self.plan['openspec'] if e['id']==cid), None)
        require(found is not None, f'unknown change: {cid}'); return found
    def active(self, cid):
        e = self.entry(cid)
        require(e['phase'] != 'done' and e.get('state') != 'cancelled', f'{cid}: terminal change is immutable')
        return e
    def mapping(self, start='.', exclude=(), normalize_tasks=False, skip_generated=False):
        path = self.file(start)
        require(path.exists(), f'missing path: {start}')
        if path.is_file():
            return {str(path.relative_to(self.root)): self.hash_file(path, normalize_tasks)}
        result = {}
        for directory, dirs, files in os.walk(path, followlinks=False):
            base = Path(directory)
            valid_dirs = []
            for name in sorted(dirs):
                p = base/name; key = str(p.relative_to(self.root))
                if (skip_generated and name in SKIP_PARTS) or any(beneath(key,x) for x in exclude): continue
                require(not p.is_symlink(), f'symlink not allowed: {key}')
                valid_dirs.append(name)
            dirs[:] = valid_dirs
            for name in sorted(files):
                p = base/name; key = str(p.relative_to(self.root))
                if any(beneath(key,x) for x in exclude): continue
                require(not p.is_symlink(), f'symlink not allowed: {key}')
                result[key] = self.hash_file(p, normalize_tasks)
        return result
    def hash_file(self, path, normalize_tasks=False):
        # Secret files are denied to native roles: never open them just to hash code.
        # Metadata still detects common edits/deletions without exposing content.
        if path.name == '.env' or path.name.startswith('.env.'):
            info=path.stat()
            return digest({'secret_metadata_only':True,'size':info.st_size,'mtime_ns':info.st_mtime_ns,'mode':info.st_mode})
        b = path.read_bytes()
        if normalize_tasks and path.name == 'tasks.md':
            b = re.sub(rb'(?m)^(\s*[-*]\s+)\[[xX ]\]', rb'\1[ ]', b)
        return digest({'content':digest(b),'executable':bool(path.stat().st_mode & 0o111)})
    def workspace(self):
        return self.mapping(exclude=('manager/runtime', 'manager/archive'), skip_generated=True)
    def code(self):
        return self.mapping(exclude=('manager/runtime','manager/archive',self.plan_rel,'openspec','docs'), skip_generated=True)
    def history(self):
        path = self.file('openspec/changes/archive')
        if not path.exists(): return {}
        result = {}
        for child in sorted(path.iterdir()):
            key = str(child.relative_to(self.root))
            require(child.is_dir() and not child.is_symlink(), 'archive root must contain directories only')
            result[key] = self.mapping(key)
        return result
    def guard_history(self):
        require(self.history() == self.state['seal'], 'archive history changed or unsealed; audit before continuing')
    def no_ticket(self):
        require(not any(t['status']=='prepared' for t in self.state['tickets'].values()), 'archive transaction pending; finalize or explicitly abort first')
    def policy(self):
        p = self.file('manager/policy.yaml'); require(p.exists(), 'missing manager/policy.yaml; configure real checks')
        data = parse(p.read_text())
        require(isinstance(data, dict) and data.get('version') == 2, 'policy version must be 2')
        require(isinstance(data.get('checks'), dict) and isinstance(data['checks'].get('apply'), list) and data['checks']['apply'], 'policy.checks.apply must contain real argv checks')
        for stage in ('change','apply'):
            for cmd in data['checks'].get(stage, []):
                require(isinstance(cmd, list) and cmd and all(isinstance(x,str) and x for x in cmd), 'checks must be nonempty argv lists, not shell strings')
        for key, default in (('max_writers',2),('max_agents',4),('timeout_seconds',300)):
            require(type(data.get(key,default)) is int and data.get(key,default)>0, f'invalid policy {key}')
        return data
    def scope(self, path, locators):
        for locator in locators:
            require(':' in locator, 'legacy unqualified scope requires explicit migration: '+locator)
            kind,value=locator.split(':',1)
            if kind=='path':
                require(path.is_dir(), 'path locator requires a directory source')
                relative=str(path.relative_to(self.root))+'/'+rel(value)
                require(self.file(relative).exists(), 'missing scoped path: '+value)
                continue
            require(path.is_file(), 'text/data locator requires a file source')
            text=path.read_text()
            if kind=='heading':
                matches=[x for x in re.findall(r'(?m)^#{1,6}\s+(.+?)\s*#*$',text) if x==value]
                require(len(matches)==1, 'heading scope must resolve exactly once: '+value)
            elif kind in ('id','anchor'):
                pattern=r'(?:id=[\"\']'+re.escape(value)+r'[\"\']|\{#'+re.escape(value)+r'\})'
                require(len(re.findall(pattern,text))==1, 'id/anchor scope must resolve exactly once: '+value)
            elif kind in ('json-pointer','operation-id'):
                data=parse(text)
                if kind=='json-pointer':
                    require(value=='' or value.startswith('/'),'invalid JSON pointer')
                    try:
                        for part in value.split('/')[1:] if value else []:
                            part=part.replace('~1','/').replace('~0','~')
                            require(not isinstance(data,list) or (part.isdecimal() and (part=='0' or not part.startswith('0'))),'invalid array index')
                            data=data[int(part)] if isinstance(data,list) else data[part]
                    except (KeyError,IndexError,TypeError,ValueError): raise Invalid('JSON pointer not found: '+value)
                else:
                    def count(node):
                        if isinstance(node,dict): return int(node.get('operationId')==value)+sum(count(x) for x in node.values())
                        if isinstance(node,list): return sum(count(x) for x in node)
                        return 0
                    require(count(data)==1,'operation-id scope must resolve exactly once: '+value)
            else: raise Invalid('unsupported scope locator: '+kind+'; provide a supported explicit snapshot/locator')

    def source(self, item):
        source = item['source']; path = item.get('snapshot', source)
        require(not re.match(r'^\w+://', path), f'{source}: explicit local snapshot required for remote sources')
        p = self.file(path)
        if not p.exists():
            require(not item.get('required',True), f'missing required source: {path}')
            return {'path':path, 'missing':True}
        try: self.scope(p,item.get('scope',[]))
        except Invalid as exc:
            if item.get('required',True): raise
            return {'path':path,'skipped':str(exc)}
        return {'path':path, 'files':self.mapping(path)}
    def requirements(self, e):
        ids = e.get('requirements',[])
        return [r for r in self.plan['requirements'] if r['id'] in ids]
    def material(self, e):
        reqs = self.requirements(e)
        inputs = resolve_inputs(self.plan,e)
        docs = list(e.get('technical_design', [])) + ([e['ui_baseline']] if e.get('ui_baseline') else [])
        return {'requirements':reqs, 'sources':[self.source(r) for r in reqs], 'inputs':[{'definition':i,'content':self.source(i)} for i in inputs], 'designs':{p:self.source({'source':p}) for p in docs}, 'policy':self.source({'source':'manager/policy.yaml'}), 'roles':self.source({'source':'manager/roles.yaml','required':False})}
    def contract(self, e):
        key = f'openspec/changes/{e["id"]}'
        parts = self.mapping(key, exclude=(key+'/findings', key+'/verify-report.md',key+'/review-notes.md'), normalize_tasks=True) if self.file(key).exists() else {}
        fields = {k:v for k,v in e.items() if k not in ('phase','state','review','blockers','inputs','input_refs','path','tasks','artifacts')}
        baseline={}
        delta=self.file(key+'/specs')
        if delta.exists():
            for child in sorted(delta.iterdir()):
                primary='openspec/specs/'+child.name
                if child.is_dir() and self.file(primary).exists(): baseline.update(self.mapping(primary))
        return digest({'entry':fields, 'material':self.material(e), 'artifacts':parts, 'baseline':baseline})
    def snapshot(self,e):
        return {'change':e['id'],'revision':e.get('revision',1),'contract':self.contract(e),'code':digest(self.code())}
    def document_approval(self, document, reqs):
        rec = self.state['approvals'].get(document)
        require(rec is not None, f'unapproved document: {document}')
        require(rec['document'] == self.source({'source':document}), f'document approval stale: {document}')
        needed = {r.get('snapshot',r['source']) for r in reqs}
        require(needed <= set(rec['sources']), f'approval does not cover PRD sources: {document}')
        for source, old in rec['sources'].items():
            require(self.source({'source':source}) == old, f'approval source changed: {source}')
    def technical(self,e):
        require(e.get('technical_design'), f'{e["id"]}: formal work needs technical_design approval')
        for path in e['technical_design']: self.document_approval(path,self.requirements(e))
    def proof(self, cid):
        rec = self.state['completed'].get(cid)
        if not rec: return False
        try:
            path = rec['archive']; require(self.file(path).exists(),'missing archive')
            proof_path=self.file(f'manager/archive/completed/{cid}.json')
            return proof_path.is_file() and decode(proof_path.read_text())==rec and self.mapping(path)==rec['files'] and self.state['seal'].get(path)==rec['files']
        except (Invalid, OSError): return False
    def valid_completions(self): return {cid for cid in self.state['completed'] if self.proof(cid)}
    def running(self): return [c for c in self.state['claims'].values() if c['status']=='running']
