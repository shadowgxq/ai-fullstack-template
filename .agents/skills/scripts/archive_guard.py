#!/usr/bin/env python3
"""Reject changes inside existing archive units relative to a trusted Git base."""
import argparse
import json
import subprocess

PREFIX='openspec/changes/archive/'
def tree(ref):
    commit=subprocess.check_output(['git','rev-parse','--verify','--end-of-options',ref+'^{commit}'],text=True).strip()
    raw=subprocess.check_output(['git','ls-tree','-r','-z',commit,'--',PREFIX])
    result={}
    for row in raw.split(b'\0'):
        if not row: continue
        meta,path=row.split(b'\t',1); path=path.decode('utf-8')
        result[path]=meta.decode()
    return result

def check(base,head):
    before,after=tree(base),tree(head)
    units={p[len(PREFIX):].split('/')[0] for p in before}
    changed=[p for p in sorted(set(before)|set(after)) if p[len(PREFIX):].split('/')[0] in units and before.get(p)!=after.get(p)]
    return {'ok':not changed,'changed_history':changed}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base',required=True);parser.add_argument('--head',default='HEAD');args=parser.parse_args()
    try: result=check(args.base,args.head)
    except (OSError,ValueError,subprocess.CalledProcessError) as exc: result={'ok':False,'error':str(exc)}
    print(json.dumps(result,ensure_ascii=False,indent=2));return 0 if result['ok'] else 1
if __name__=='__main__': raise SystemExit(main())
