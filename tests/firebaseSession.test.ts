import test from 'node:test';import assert from 'node:assert/strict';
import config from '../firebase-applet-config.json' with {type:'json'};
import {verifyFirebaseSession,lookupFirebaseSession,forgetFirebaseSessions} from '../api/_lib/firebaseSession.js';
import {teacherActor} from '../api/_lib/teacherWorkspaceAuth.js';
const decoded:any={uid:'user',sub:'user',auth_time:100,aud:config.projectId,iss:`https://securetoken.google.com/${config.projectId}`};
const response=(body:any,status=200)=>async()=>new Response(JSON.stringify(body),{status});
test('teacher room authenticates with restricted Admin role while still denying disabled workspace access',async()=>{
 const previous=globalThis.fetch,admin=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';let disabled=false;
 globalThis.fetch=response({users:[{localId:'user',validSince:'100'}]}) as typeof fetch;
 const initialize:any=()=>({auth:{verifyIdToken:async(_:string,revoked:boolean)=>{if(revoked)throw {code:'auth/insufficient-permission'};return decoded;}},db:{collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='academyCoreAuthority'?{active:true}:name==='users'?{role:'teacher'}:{academyId:'main',disabled,scopes:[]}})})})}});
 try{const request:any={headers:{authorization:'Bearer signed'}};assert.equal((await teacherActor(request,initialize)).uid,'user');disabled=true;await assert.rejects(teacherActor(request,initialize),/TEACHER_NOT_CONFIGURED/);}finally{globalThis.fetch=previous;if(admin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=admin;}
});
test('Admin permission failure retains signed token verification and account lookup',async()=>{
 const checks:boolean[]=[],auth:any={verifyIdToken:async(token:string,revoked:boolean)=>{assert.equal(token,'signed');checks.push(revoked);if(revoked)throw {code:'auth/insufficient-permission'};return decoded;}};
 let lookup=0;assert.equal((await verifyFirebaseSession(auth,'signed',async(token,value)=>{lookup++;assert.equal(value.uid,'user');await lookupFirebaseSession(token,value,response({users:[{localId:'user',disabled:false,validSince:'100'}]}) as any);})).uid,'user');assert.deepEqual(checks,[true,false]);assert.equal(lookup,1);
});
test('revoked, disabled, bad signatures and unrelated backend failures cannot bypass account checks',async()=>{
 for(const error of [{code:'auth/id-token-revoked'},{code:'auth/user-disabled'},{code:'auth/argument-error'},{code:'auth/internal-error',message:'timeout'},{code:'app/invalid-credential'}]){let count=0;await assert.rejects(verifyFirebaseSession({verifyIdToken:async()=>{count++;throw error;}} as any,'token',async()=>assert.fail('no fallback')));assert.equal(count,1);}
 let calls=0;await assert.rejects(verifyFirebaseSession({verifyIdToken:async()=>{if(++calls===1)throw {code:'auth/insufficient-permission'};throw Error('bad signature');}} as any,'token',async()=>assert.fail('no unsigned lookup')),/bad signature/);
});
test('account REST denies disabled, deleted, revoked or mismatched users',async()=>{
 await assert.rejects(lookupFirebaseSession('token',decoded,response({users:[{localId:'user',disabled:true}]}) as any),e=>(e as any).code==='auth/user-disabled');
 await assert.rejects(lookupFirebaseSession('token',decoded,response({users:[{localId:'user',validSince:'101'}]}) as any),e=>(e as any).code==='auth/id-token-revoked');
 for(const code of ['USER_NOT_FOUND','INVALID_ID_TOKEN','TOKEN_EXPIRED','USER_DISABLED'])await assert.rejects(lookupFirebaseSession('token',decoded,response({error:{message:code}},400) as any),e=>(e as any).code==='auth/id-token-revoked');
 for(const body of [{users:[]},{users:[{localId:'other'}]},{users:[{localId:'user',validSince:'bad'}]}])await assert.rejects(lookupFirebaseSession('token',decoded,response(body) as any),/AUTH_SERVER_CONFIG_ERROR/);
});
test('account lookup sends only ID token, checks project and fails closed on configuration or outages',async()=>{
 await lookupFirebaseSession('private-token',decoded,(async(url,options)=>{assert.match(String(url),/^https:\/\/identitytoolkit.googleapis.com\/v1\/accounts:lookup\?key=/);assert.deepEqual(JSON.parse(String(options?.body)),{idToken:'private-token'});assert.equal(options?.method,'POST');return new Response(JSON.stringify({users:[{localId:'user',validSince:'0'}]}));}) as typeof fetch);
 for(const value of [{...decoded,aud:'other'},{...decoded,iss:'other'},{...decoded,firebase:{tenant:'other'}}])await assert.rejects(lookupFirebaseSession('token',value,async()=>assert.fail('no request')),/AUTH_SERVER_CONFIG_ERROR/);
 for(const fetcher of [response({error:{message:'PERMISSION_DENIED'}},403),response({},500),async()=>{throw Error('private raw error');}])await assert.rejects(lookupFirebaseSession('token',decoded,fetcher as any),/AUTH_SERVER_CONFIG_ERROR/);
});
test('known permission-denied internal error recovers, normal Admin success needs no REST',async()=>{
 let calls=0;await verifyFirebaseSession({verifyIdToken:async()=>{if(++calls===1)throw {code:'auth/internal-error',message:'PERMISSION_DENIED: firebaseauth.users.get'};return decoded;}} as any,'token',async()=>{});assert.equal(calls,2);
 assert.equal((await verifyFirebaseSession({verifyIdToken:async()=>decoded} as any,'token',async()=>assert.fail('no REST'))).uid,'user');
});
test('simultaneous authentication is deduplicated without caching completed account checks',async()=>{
 let complete:any,count=0;const auth:any={verifyIdToken:()=>{count++;return new Promise(resolve=>complete=resolve);}};
 const first=verifyFirebaseSession(auth,'same'),second=verifyFirebaseSession(auth,'same');assert.equal(count,1);complete(decoded);await Promise.all([first,second]);
 const next=verifyFirebaseSession(auth,'same');assert.equal(count,2);complete(decoded);await next;
});
test('a known missing Admin permission is not retried on every request, while each request still checks the account',async()=>{
 const checks:boolean[]=[],auth:any={verifyIdToken:async(_token:string,revoked:boolean)=>{checks.push(revoked);if(revoked)throw {code:'auth/insufficient-permission'};return decoded;}};
 let disabled=false,lookups=0;const lookup=async(token:string,value:any)=>{lookups++;await lookupFirebaseSession(token,value,response({users:[{localId:'user',disabled,validSince:'100'}]}) as any);};
 await verifyFirebaseSession(auth,'first',lookup);await verifyFirebaseSession(auth,'second',lookup);
 assert.deepEqual(checks,[true,false,false],'the failing Admin attempt happens once, then only signature checks');assert.equal(lookups,2,'the account is looked up on every request');
 disabled=true;await assert.rejects(verifyFirebaseSession(auth,'third',lookup),/user-disabled/);
});
test('a passed check is remembered up to 60 seconds, never past the token expiry, and forgotten when the account is removed',async()=>{
 const clock=Date.now;let now=1_000_000_000_000;Date.now=()=>now;
 try{
  let count=0;const auth:any={verifyIdToken:async()=>{count++;return {...decoded,uid:'kept',exp:Math.floor(now/1000)+3600};}};
  await verifyFirebaseSession(auth,'kept-token');await new Promise(r=>setImmediate(r));
  await verifyFirebaseSession(auth,'kept-token');assert.equal(count,1,'remembered within a minute');
  now+=61_000;await verifyFirebaseSession(auth,'kept-token');assert.equal(count,2,'checked again after a minute');
  await new Promise(r=>setImmediate(r));forgetFirebaseSessions('kept');await verifyFirebaseSession(auth,'kept-token');assert.equal(count,3,'forgotten on removal');
  let soon=0;const expiring:any={verifyIdToken:async()=>{soon++;return {...decoded,uid:'soon',exp:Math.floor(now/1000)+10};}};
  await verifyFirebaseSession(expiring,'soon-token');await new Promise(r=>setImmediate(r));now+=11_000;await verifyFirebaseSession(expiring,'soon-token');assert.equal(soon,2,'never past the token expiry');
  const other:any={verifyIdToken:async()=>{count++;return {...decoded,uid:'kept',exp:Math.floor(now/1000)+3600};}};
  await verifyFirebaseSession(other,'kept-token');assert.equal(count,4,'remembered per Firebase instance only');
 }finally{Date.now=clock;}
});
test('a check that started before forget neither refills the memory nor serves requests after it',async()=>{
 const slowAuth=()=>{let count=0;const releases:any[]=[];return {get count(){return count;},release:()=>releases.shift()(),auth:{verifyIdToken:()=>{count++;return new Promise(r=>releases.push(()=>r({...decoded,uid:'late',exp:Math.floor(Date.now()/1000)+3600})));}} as any};};
 // delayed check started -> forget -> check completes -> the next request is checked again
 let s=slowAuth();const late=verifyFirebaseSession(s.auth,'late-token');forgetFirebaseSessions('late');s.release();await late;await new Promise(r=>setImmediate(r));
 const next=verifyFirebaseSession(s.auth,'late-token');assert.equal(s.count,2,'the late result was not remembered');s.release();await next;
 // a request made after forget does not join the check started before it
 s=slowAuth();const before=verifyFirebaseSession(s.auth,'join-token');forgetFirebaseSessions('late');const after=verifyFirebaseSession(s.auth,'join-token');
 assert.equal(s.count,2,'a new check is started');s.release();s.release();await Promise.all([before,after]);
});
