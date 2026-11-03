import {CHECKS,M,loadWasmEngine,runCheck,auditVerdict,colorForCell} from '../../scripts/interaction-scenes.mjs';
import {CANDIDATES} from './review-req.mjs';
const engine=await loadWasmEngine();
const c=CHECKS.find(c=>c.role==='is stilled by nearby ice');
const candidates=[...CANDIDATES,{...c,label:'spring taught sand',paint:p=>c.paint((x,y,r,m,d)=>p(x,y,r,m===M.Water?M.Sand:m,d))}];
for(const c of candidates){let pass=0;for(let k=0;k<32;k++){const r=runCheck({...c,seed:c.seed+k*1000},{engine,colorForCell});pass+=auditVerdict({...c,...r}).kind==='pass';}console.log(c.label,pass+'/32');}
