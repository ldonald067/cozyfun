import { readFileSync,writeFileSync,mkdirSync,copyFileSync } from 'node:fs';
import { CHECKS,runCheck,jsEngine,colorForCell,auditVerdict,M } from '../../scripts/interaction-scenes.mjs';
import { compileApp } from '../../scripts/compile-app.mjs';
const root=process.cwd()+'/.tmp/halves/review-provenance';mkdirSync(root+'/app/src',{recursive:true});
let src=readFileSync('app/src/engine.ts','utf8');
for (const energy of [180,200]) src=src.replace(`writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], ${energy});`,`writeCellBytes(next, idx, MATERIAL.Stardust, 250, ${energy});`);
writeFileSync(root+'/app/src/engine.ts',src);copyFileSync('app/src/materials.ts',root+'/app/src/materials.ts');
const engine=jsEngine(compileApp('review-provenance',['engine.ts','materials.ts'],{root}).load('engine').createFallbackEngine);
for(const role of ['lands as stardust','bursts against a ceiling']){
 const c=CHECKS.find(c=>c.role===role);let bad=0,total=0,first=null;
 const outcome=(g,b,m,p)=>{const hit=c.outcome(g,b,m,p);for(const i of hit){total++;if(g.cells[i*8+1]!==250){bad++;first??={i,variant:g.cells[i*8+1],age:g.cells[i*8+2]+256*g.cells[i*8+3]};}}return hit;};
 const r=runCheck({...c,outcome},{engine,colorForCell}); console.log({role,bad,total,first,r});
}
