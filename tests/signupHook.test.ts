import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {newSignups} from '../api/_lib/signupHook.js';
import {handleSignupHook} from '../api/teacher/workspace.js';
const DOC_ID='__name__';
function cursorFirestore(){
 const rows=new Map<string,any>(),queries:any[]=[];
 const query=(name:string,s:any={filters:[],order:[],after:null,limit:Infinity}):any=>({
  doc:(id:string)=>({path:name+'/'+id,get:async()=>({data:()=>rows.get(name+'/'+id)})}),
  where:(f:string,op:string,v:any)=>query(name,{...s,filters:[...s.filters,[f,op,v]]}),
  orderBy:(f:any)=>query(name,{...s,order:[...s.order,f]}),
  startAfter:(...v:any[])=>query(name,{...s,after:v}),
  limit:(n:number)=>query(name,{...s,limit:n}),
  get:async()=>{queries.push(s);const key=(id:string,d:any)=>s.order.map((f:any)=>f===DOC_ID?id:d[f]);
   const cmp=(a:any[],b:any[])=>{for(let i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return 0;};
   let docs=[...rows.entries()].filter(([k])=>k.startsWith(name+'/')).map(([k,d])=>({id:k.slice(name.length+1),d}))
    .filter(({d})=>s.filters.every(([f,op,v]:any)=>typeof d[f]==='number'&&(op==='>'?d[f]>v:op==='>='?d[f]>=v:true)));
   docs.sort((a,b)=>cmp(key(a.id,a.d),key(b.id,b.d)));if(s.after)docs=docs.filter(x=>cmp(key(x.id,x.d),s.after)>0);
   return {docs:docs.slice(0,s.limit).map(x=>({id:x.id,data:()=>x.d}))};}
 });
 return {rows,queries,db:{collection:(n:string)=>query(n),runTransaction:async(fn:any)=>fn({set:(ref:any,data:any)=>rows.set(ref.path,data)})}};
}

test('새 가입자 알림: the first call starts the clock, later calls return only new accounts once, with a mail body',async()=>{
 const f=cursorFirestore(),stamp=(ms:number)=>ms;
 f.rows.set('users/old',{name:'예전 학생',email:'o@x.kr',createdAt:1000});
 assert.deepEqual(await newSignups(f.db,5000,stamp,DOC_ID),{first:true,count:0,users:[],more:false,text:''},'nothing old is mailed');
 f.rows.set('users/new',{alias:'정하늘',email:'h@x.kr',createdAt:Date.parse('2026-10-13T12:30:00Z')});
 const r=await newSignups(f.db,Date.parse('2026-10-13T13:00:00Z'),stamp,DOC_ID);
 assert.equal(r.count,1);assert.equal(r.users[0].name,'정하늘');assert.equal(r.users[0].email,'h@x.kr');assert.match(r.users[0].joinedAt,/21:30/,'Seoul time');
 assert.match(r.text,/새로 가입한 계정 1개\n· 정하늘 \(h@x\.kr\)/);
 assert.equal((await newSignups(f.db,Date.parse('2026-10-13T13:15:00Z'),stamp,DOC_ID)).count,0,'not mailed twice');
});
test('새 가입자 알림 endpoint: GET with the Make secret only',async()=>{
 const call=async(headers:any,method='GET')=>{let status=0,body:any;const res:any={setHeader(){},end(v:string){body=JSON.parse(v);},set statusCode(v:number){status=v;},get statusCode(){return status;}};await handleSignupHook({method,headers} as any,res,(()=>({db:templateFirestore().db})) as any);return {status,body};};
 const old=process.env.MAKE_HOOK_SECRET;process.env.MAKE_HOOK_SECRET='';
 assert.equal((await call({authorization:'Bearer anything'})).status,401,'off until the secret is set');
 process.env.MAKE_HOOK_SECRET='s'.repeat(20);
 assert.equal((await call({authorization:'Bearer wrong'})).status,401);
 assert.equal((await call({authorization:'Bearer '+'s'.repeat(20)},'POST')).status,405);
 const ok=await call({authorization:'Bearer '+'s'.repeat(20)});assert.equal(ok.status,200);assert.equal(ok.body.first,true);
 process.env.MAKE_HOOK_SECRET=old;
});
test('새 가입자 알림 pages through any number of accounts with the same sign-up time (Firestore cursor on time and id)',async()=>{
 const f=cursorFirestore(),stamp=(ms:number)=>ms;
 await newSignups(f.db,1000,stamp,DOC_ID);
 for(let i=0;i<130;i++)f.rows.set('users/u'+String(i).padStart(3,'0'),{name:'학생'+i,email:`s${i}@x.kr`,createdAt:2000});
 f.rows.set('users/older',{name:'예전',email:'old@x.kr',createdAt:'2026-01-01'});
 const seen:string[]=[];let more=true,calls=0;
 while(more&&calls<10){const r=await newSignups(f.db,3000+calls,stamp,DOC_ID);seen.push(...r.users.map((u:any)=>u.email));more=r.more;calls++;}
 assert.equal(seen.length,130);assert.equal(new Set(seen).size,130,'each once, none skipped');assert.ok(!seen.includes('old@x.kr'),'a non-Timestamp createdAt is never mailed');
 assert.equal((await newSignups(f.db,9000,stamp,DOC_ID)).count,0);
 const q=f.queries.at(-1);assert.deepEqual(q.order,['createdAt',DOC_ID]);assert.deepEqual(q.after,[2000,'u129'],'the cursor is (time, id) in the query itself');
});
test('새 가입자 알림: accounts sharing one sign-up time are not skipped across the 50-per-call limit',async()=>{
 const f=cursorFirestore(),stamp=(ms:number)=>ms;
 await newSignups(f.db,1000,stamp,DOC_ID);
 for(let i=0;i<53;i++)f.rows.set('users/u'+String(i).padStart(2,'0'),{name:'학생'+i,email:`s${i}@x.kr`,createdAt:2000});
 const a=await newSignups(f.db,3000,stamp,DOC_ID),b=await newSignups(f.db,4000,stamp,DOC_ID);
 assert.equal(a.count,50);assert.equal(a.more,true);assert.equal(b.count,3,'the 3 with the same time come next');
 assert.deepEqual(new Set([...a.users,...b.users].map((u:any)=>u.email)).size,53,'each once');
 assert.equal((await newSignups(f.db,5000,stamp,DOC_ID)).count,0);
});
test('새 가입자 알림 failure log carries only the error code',async()=>{
 const fs=await import('node:fs'),src=fs.readFileSync(new URL('../api/teacher/workspace.ts',import.meta.url),'utf8');
 const handler=src.slice(src.indexOf('export async function handleSignupHook'),src.indexOf('export async function handleWorkspace'));
 assert.doesNotMatch(handler,/error\?\.message/);assert.match(handler,/console\.warn\('SIGNUP_HOOK_FAILED',\{code:/);
});
