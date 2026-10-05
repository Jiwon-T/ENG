import {createHash,randomUUID} from 'node:crypto';
import {teacherReadKey} from './teacherReadCache.js';
import {normalizeNotionPageId} from './notionPageId.js';
const normalized=(v:string)=>normalizeNotionPageId(v);
export function matchesNotionFilter(page:any,filter:any):boolean {
 if(!filter)return !page.archived&&!page.in_trash;
 if(page.archived||page.in_trash)return false;
 if(filter.and)return filter.and.every((f:any)=>matchesNotionFilter(page,f));
 if(filter.or)return filter.or.some((f:any)=>matchesNotionFilter(page,f));
 const p=page.properties?.[filter.property];
 if(filter.relation)return (p?.relation||[]).some((r:any)=>normalized(r.id)===normalized(filter.relation.contains));
 if(filter.rich_text){const value=(p?.rich_text||[]).map((t:any)=>t.plain_text??t.text?.content??'').join('');return filter.rich_text.is_empty?value==='':value===filter.rich_text.equals;}
 if(filter.select){const value=p?.select?.name||'';return filter.select.is_empty?!value:value===filter.select.equals;}
 if(filter.date){const date=Date.parse(p?.date?.start||'');if(!Number.isFinite(date))return false;return Object.entries(filter.date).every(([op,value])=>op==='on_or_after'?date>=Date.parse(value as string):op==='before'?date<Date.parse(value as string):op==='on_or_before'?date<=Date.parse(value as string):false);}
 throw new Error('INVALID_MIRROR_FILTER');
}
// Persistent server-only raw pages, isolated by current permissions and query.
// Delta reads include moved-out rows; full reconciliation detects archive/deletion.
export async function readMirroredPages(db:any,actor:any,database:string,filter:any,load:(filter?:any)=>Promise<any[]>,force=false) {
 if(typeof db.batch!=='function'||typeof db.runTransaction!=='function')return load(filter);
 const key=createHash('sha256').update(teacherReadKey(actor,JSON.stringify([database,filter||null]))).digest('hex');
 const ref=db.collection('teacherNotionMirrors').doc(key),pagesRef=ref.collection('pages');
 const owner=randomUUID(),started=Date.now();
 const state=await db.runTransaction(async(t:any)=>{
  const old=(await t.get(ref)).data()||{};
  if(old.leaseUntil>started)return {...old,claimed:false};
  if(!force&&old.ready&&started-old.syncedAt<60_000)return {...old,claimed:false};
  t.set(ref,{...old,leaseOwner:owner,leaseUntil:started+300_000});return {...old,claimed:true};
 });
 const existing=(await pagesRef.get()).docs.map((d:any)=>({id:d.id,page:JSON.parse(d.data().json)}));
 if(!state.claimed){if(force)return load(filter);if(state.ready)return existing.map((r:any)=>r.page).filter((p:any)=>matchesNotionFilter(p,filter));return load(filter);}
 try {
  const full=force||!state.ready||started-(state.reconciledAt||0)>=600_000;
  const changed=await load(full?filter:{timestamp:'last_edited_time',last_edited_time:{on_or_after:new Date(state.syncedAt-2000).toISOString()}});
  const pages=new Map<string,any>(full?[]:existing.map((r:any)=>[r.id,r.page]));
  for(const page of changed){const id=normalized(page.id);if(matchesNotionFilter(page,filter))pages.set(id,page);else pages.delete(id);}
  const writes:any[]=[];
  for(const [id,page] of pages)if(!existing.some((r:any)=>r.id===id&&JSON.stringify(r.page)===JSON.stringify(page)))writes.push({ref:pagesRef.doc(id),value:{json:JSON.stringify(page)}});
  for(const old of existing)if(!pages.has(old.id))writes.push({ref:pagesRef.doc(old.id)});
  // Keep the checkpoint last: a failed page batch is safely replayed next time.
  for(let offset=0;offset<writes.length;offset+=400){const batch=db.batch();for(const w of writes.slice(offset,offset+400))w.value?batch.set(w.ref,w.value):batch.delete(w.ref);await batch.commit();}
  await db.runTransaction(async(t:any)=>{const latest=(await t.get(ref)).data();if(latest?.leaseOwner!==owner)throw new Error('MIRROR_LEASE_LOST');t.set(ref,{ready:true,syncedAt:started,reconciledAt:full?started:state.reconciledAt,leaseOwner:null,leaseUntil:0});});
  return [...pages.values()];
 } catch(error) {
  await db.runTransaction(async(t:any)=>{const latest=(await t.get(ref)).data();if(latest?.leaseOwner===owner)t.set(ref,{...latest,leaseUntil:0,leaseOwner:null});}).catch(()=>{});
  throw error;
 }
}
export function workspaceSourceFilter(source:any,actor:any) {
 if(!source.shared)return undefined;
 const filters:any[]=[{property:'학원',rich_text:{equals:source.academyId}}];
 // Author-only legacy schemas vary; rowSource rechecks owner/assigned access.
 // Academy scoping is safe even when the author property has not been created.
 return filters.length===1?filters[0]:{and:filters};
}
