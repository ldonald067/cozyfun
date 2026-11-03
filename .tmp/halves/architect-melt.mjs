import {CHECKS,runCheck,auditVerdict,colorForCell,M,loadWasmEngine} from '../../scripts/interaction-scenes.mjs';
const engine=await loadWasmEngine(), c=CHECKS.find(c=>c.role==='hot water melts ice');
for(let k=0;k<32;k++){
const a=runCheck({...c,seed:c.seed+k*1000},{engine,colorForCell});
const b=runCheck({...c,seed:c.seed+k*1000,outcome(g,b,m,p){if(m.melted)for(const i of m.melted)if(p.kindOf(i)!==M.Water||g.kindOf(i)!==M.Water)m.melted.delete(i);return c.outcome(g,b,m,p);}},{engine,colorForCell});
console.log(k,a.visibleTicks,b.visibleTicks,auditVerdict({...c,...a}).kind,auditVerdict({...c,...b}).kind);
}
