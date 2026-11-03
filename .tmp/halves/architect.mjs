import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CHECKS,jsEngine,runCheck,auditVerdict,colorForCell,M,F,loadWasmEngine} from '../../scripts/interaction-scenes.mjs';
import {compileApp} from '../../scripts/compile-app.mjs';
const root=resolve('.tmp/halves/architect-root');mkdirSync(root+'/app/src',{recursive:true});
let src=readFileSync('app/src/engine.ts','utf8');src=src.replace('if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);','if (false) this.powder(idx, x, y, cell, old, next);');
writeFileSync(root+'/app/src/engine.ts',src);copyFileSync('app/src/materials.ts',root+'/app/src/materials.ts');
const engine=jsEngine(compileApp('architect-engine',['engine.ts','materials.ts'],{root}).load('engine').createFallbackEngine);
const c=CHECKS.find(c=>c.role==='falls at half pace when wet');for(let k=0;k<8;k++){const r=runCheck({...c,seed:c.seed+k*1000},{engine,colorForCell});console.log('never-fall',k,r,auditVerdict({...c,...r}));}
const wasm=await loadWasmEngine();const melt=CHECKS.find(c=>c.role==='hot water melts ice');
for(let k=0;k<8;k++){let stale=0,total=0;const r=runCheck({...melt,seed:melt.seed+k*1000,outcome(g,b,m,p){const old=new Set(m.melted??[]);const hit=melt.outcome(g,b,m,p);m.expired??=new Set();for(const i of old)if(g.kindOf(i)!==M.Water)m.expired.add(i);for(const i of hit){total++;if(m.expired.has(i))stale++;}return hit;}},{engine:wasm,colorForCell});console.log('melt-stale',k,stale,total,r);}
