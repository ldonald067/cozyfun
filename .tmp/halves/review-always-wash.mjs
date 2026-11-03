import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {compileApp} from '../../scripts/compile-app.mjs';
import {CHECKS,jsEngine,runCheck,auditVerdict,colorForCell} from '../../scripts/interaction-scenes.mjs';
const root=resolve('.tmp/halves/review-always-wash');
mkdirSync(resolve(root,'app/src'),{recursive:true});
let src=readFileSync('app/src/engine.ts','utf8');
const find='readU16(old, nidx + 4) < COLD_CHAR_ENERGY && waterCanFlow && this.chance(12)';
if(src.split(find).length!==2) throw Error('match');
src=src.replace(find,'readU16(old, nidx + 4) < COLD_CHAR_ENERGY && this.chance(12)');
writeFileSync(resolve(root,'app/src/engine.ts'),src);
copyFileSync('app/src/materials.ts',resolve(root,'app/src/materials.ts'));
const app=compileApp('review-always-wash',['engine.ts','materials.ts'],{root});
const engine=jsEngine(app.load('engine').createFallbackEngine);
for(const c of CHECKS.filter(c=>c.covers==='ember.quenched')){
let passes=0;
for(let k=0;k<32;k++){const r=runCheck({...c,seed:c.seed+k*1000},{engine,colorForCell});if(auditVerdict({...c,...r}).kind==='pass')passes++;}
console.log(c.role,passes);
}
