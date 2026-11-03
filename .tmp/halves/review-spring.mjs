import {CHECKS,M} from '../../scripts/interaction-scenes.mjs';
const c=CHECKS.find(c=>c.role==='is stilled by nearby ice');
export const CANDIDATES=[{...c,label:'sand spring',paint:p=>c.paint((x,y,r,m,d)=>p(x,y,r,m===M.Water?M.Sand:m,d))}];
export const AGAINST={'sand spring':['spring-never-stilled']};
