import { CHECKS, M } from '../../scripts/interaction-scenes.mjs';
const roles = ['smothers hydration so seeds cannot sprout','is blocked from feeding life by oil','is smothered by an oil coating'];
export const CANDIDATES = roles.map(role => {const c=CHECKS.find(c=>c.role===role); return {...c,label:role+' soil as wall',paint:p=>c.paint((x,y,r,m,d)=>p(x,y,r,m===M.Soil?M.Wall:m,d))};});
export const AGAINST = Object.fromEntries(CANDIDATES.map(c=>[c.label,['oil-never-smothers']]));
