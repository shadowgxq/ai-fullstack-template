#!/usr/bin/env python3
"""Self-authored protocol fixture. Not Pencil's server or official mock."""
import argparse
import json
from pathlib import Path
import sys
import time

p = argparse.ArgumentParser(); p.add_argument('--mode',default='ok'); p.add_argument('--log'); args = p.parse_args()

def tool():
    schema = {'type':'object','properties':{},'additionalProperties':False}
    if args.mode == 'required': schema.update(properties={'document':{'type':'string'}},required=['document'])
    return {'name':'get_app_state','description':'Fixture read-only state','inputSchema':schema,'annotations':{'readOnlyHint':True}}

for line in sys.stdin:
    message = json.loads(line); method = message.get('method')
    if args.log:
        with Path(args.log).open('a') as log: log.write(json.dumps({'method':method,'tool':message.get('params',{}).get('name')})+'\n')
    if 'id' not in message: continue
    if args.mode == 'timeout': time.sleep(10)
    if method == 'initialize':
        result = {'protocolVersion':'2025-06-18','capabilities':{'tools':{}},'serverInfo':{'name':'pencil-fixture-not-live','version':'1'}}
    elif method == 'tools/list':
        if args.mode == 'no-state': result = {'tools':[{'name':'execute','inputSchema':{'type':'object'}}]}
        elif args.mode == 'pagination' and not message.get('params',{}).get('cursor'): result = {'tools':[],'nextCursor':'page-2'}
        elif args.mode == 'cursor-loop': result = {'tools':[],'nextCursor':'same'}
        else: result = {'tools':[tool(),{'name':'execute','inputSchema':{'type':'object'}}]}
    elif method == 'tools/call':
        if message['params']['name'] != 'get_app_state':
            raise RuntimeError('probe must not call execute or write tools')
        if args.mode == 'error': result = {'isError':True,'content':[{'type':'text','text':'fixture denied'}]}
        elif args.mode == 'empty': result = {'content':[]}
        else: result = {'content':[{'type':'text','text':json.dumps({'document':'fixture/home.pen','dirty':False,'selection':['home'],'fixture':True})}]}
    else:
        print(json.dumps({'jsonrpc':'2.0','id':message['id'],'error':{'code':-32601,'message':'unsupported'}}),flush=True); continue
    print(json.dumps({'jsonrpc':'2.0','id':message['id'],'result':result}),flush=True)
