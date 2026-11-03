import {createRequire} from 'node:module';
import {CHECKS,jsEngine,runCheck,auditVerdict,colorForCell} from '../../scripts/interaction-scenes.mjs';
import {compileApp} from '../../scripts/compile-app.mjs';
const require=createRequire(import.meta.url);
const baseline=jsEngine(compileApp('review-wash-baseline',['engine.ts','materials.ts']).load('engine').createFallbackEngine);
const mutant=jsEngine(require('../review-always-wash/engine.js').createFallbackEngine);
let regressions=0;
for(const [i,c] of CHECKS.entries()) {
const a=auditVerdict({...c,...runCheck(c,{engine:baseline,colorForCell})});
const b=auditVerdict({...c,...runCheck(c,{engine:mutant,colorForCell})});
if(a.kind==='pass'&&b.kind!=='pass'){regressions++;console.log('DETECTED',c.covers,c.role,b);}
if(i%25===0)console.log('progress',i);
}
console.log('regressions',regressions,'checks',CHECKS.length);
