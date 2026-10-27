import { describe, expect, it } from 'vitest';
import { rankProducts, buildRoutine, type Product, type UserPrefs } from './recommendations';
const p=(name:string,category:string,price:number,concerns:string[]=['hydration']):Product=>({id:name,name,brand:'Test',description:'Catalog test',ingredients:['glycerin'],skin_suitability:['sensitive'],concerns,category,price,currency:'USD',image_url:null,retailer_url:null,sample_data:true});
const prefs:UserPrefs={budget:20,currency:'USD',skin_goals:['hydration'],preferences:{sensitive:true}};
describe('catalog recommendation engine',()=>{
 it('only ranks products that fit currency and budget',()=>{const ranked=rankProducts([p('affordable','cleanser',9),p('too costly','serum',25),{...p('other currency','moisturizer',5),currency:'NGN'}],prefs);expect(ranked.map(x=>x.product.name)).toEqual(['affordable']);});
 it('ranks concern-matched products ahead of generic eligible options',()=>{const ranked=rankProducts([p('generic','cleanser',8,[]),p('matched','serum',12)],prefs);expect(ranked[0].product.name).toBe('matched');});
 it('builds practical morning and evening steps from available catalog products',()=>{const routine=buildRoutine([p('wash','cleanser',5),p('cream','moisturizer',8),p('spf','sunscreen',10),p('serum','serum',12)],prefs);expect(routine.morning.map(s=>s.category)).toEqual(['cleanser','moisturizer','sunscreen']);expect(routine.evening.some(s=>s.category==='treatment')).toBe(true);});
});
