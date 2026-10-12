// Real React and Vue SFC runtimes exercise capture; this is not an LLM fidelity eval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../scripts/web.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deps = process.env.DESIGN_QA_NODE_ROOT;

test('React and Vue SFC: actions, aligned screenshot, exact checks and negative detection', {skip:!deps}, async t => {
  const require = createRequire(path.join(deps,'package.json'));
  const esbuild = require('esbuild');
  const { parse, compileScript } = require('@vue/compiler-sfc');
  const design = JSON.parse(readFileSync(path.join(root,'design-to-code/tests/fixtures/home.pen'),'utf8'));
  const primary = design.variables['color.primary'].value;
  const react = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';function App(){const[n,set]=useState(0);return React.createElement('main',{id:'ready'},React.createElement('h1',null,'Overview'),React.createElement('section',{id:'card'},'Sample balance: 12,345.67'),React.createElement('button',{id:'primary',onClick:()=>set(n+1)},'Continue'),React.createElement('span',{id:'counter'},'Count:'+n),React.createElement('span',{className:'duplicate'},'a'),React.createElement('span',{className:'duplicate'},'b'),React.createElement('span',{id:'hidden',style:{display:'none'}},'hidden'))}createRoot(document.getElementById('app')).render(React.createElement(App));`;
  const sfc = `<script setup>import{ref}from'vue';const n=ref(0);</script><template><main id="ready"><h1>Overview</h1><section id="card">Sample balance: 12,345.67</section><button id="primary" @click="n++">Continue</button><span id="counter">Count:{{n}}</span><span class="duplicate">a</span><span class="duplicate">b</span><span id="hidden" style="display:none">hidden</span></main></template>`;
  const {descriptor} = parse(sfc);
  const vue = compileScript(descriptor,{id:'home-fixture',inlineTemplate:true,genDefaultAs:'__sfc__'}).content + `\nimport{createApp}from'vue';createApp(__sfc__).mount('#app');`;
  const bundles = {};
  for(const [name,code] of Object.entries({react,vue})) bundles[name] = (await esbuild.build({stdin:{contents:code,resolveDir:deps,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})).outputFiles[0].text;
  const css = `:root{--primary:${primary};--space:24px}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}main{padding:var(--space);display:flex;flex-direction:column;gap:16px}h1{margin:0;font-size:24px}#card{height:144px;border-radius:12px;background:#f1f4f8}#primary{width:120px;height:40px;border:0;border-radius:8px;background:var(--primary);color:white;font-size:16px}`;
  const server = createServer((req,res) => {
    const name = req.url.startsWith('/vue') ? 'vue' : 'react';
    if(req.url.endsWith('.js')){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundles[name]);}
    else {res.writeHead(200,{'content-type':'text/html'});res.end(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="app"></div><script src="/${name}.js"></script></body></html>`);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const output = process.env.DESIGN_QA_RESULTS || mkdtempSync(path.join(tmpdir(),'design-browser-'));
  mkdirSync(output,{recursive:true});
  try {
    for(const framework of ['react','vue']) await t.test(framework,async()=>{
      const checks = [{name:'primary',selector:'#primary',expect:{'background-color':primary,'font-size':'16px','border-radius':'8px'},expectBox:{width:120,height:40}}];
      const actions = [{type:'click',selector:'#primary'},{type:'assert',selector:'#counter',text:'Count:1'}];
      const cfile=path.join(output,framework+'-checks.json'), afile=path.join(output,framework+'-actions.json');
      writeFileSync(cfile,JSON.stringify(checks));writeFileSync(afile,JSON.stringify(actions));
      const args={url:base+'/'+framework,out:path.join(output,framework+'.png'),viewport:'390x844',dpr:'1',ready:'#ready',checks:cfile,actions:afile,'full-page':false,snapshot:'fixture-home-v1',target:framework+'-web-home',build:'fixture-runtime'};
      const pass=await collect(args);
      assert.equal(pass.exitCode,0,JSON.stringify(pass));assert.equal(pass.result.runtime_checks,'passed');assert.equal(pass.result.measurement_checks,'passed');assert.equal(pass.result.visual_checks,'not_run');
      assert.deepEqual({width:pass.result.image.width,height:pass.result.image.height},{width:390,height:844});
      assert.ok(existsSync(args.out+'.measurements.json'));assert.equal(pass.measurements[0].mismatches.length,0);
      await assert.rejects(()=>collect(args),/already exists/);
      const bad=[{selector:'#primary',expect:{'font-size':'99px'}},{selector:'.duplicate',expect:{'font-size':'16px'}},{selector:'#absent',box:true},{selector:'#hidden',box:true}];
      writeFileSync(cfile,JSON.stringify(bad));
      const fail=await collect({...args,out:path.join(output,framework+'-negative.png')});
      assert.equal(fail.exitCode,2);assert.equal(fail.result.measurement_checks,'failed');
      assert.ok(fail.measurements.some(e=>e.mismatches.some(m=>m.kind==='ambiguous-selector')));
      assert.ok(fail.measurements.some(e=>e.mismatches.some(m=>m.kind==='missing-element')));
      assert.ok(fail.measurements.some(e=>e.mismatches.some(m=>m.kind==='invisible-element')));
    });
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
