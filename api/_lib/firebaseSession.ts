import firebaseConfig from '../../firebase-applet-config.json' with {type:'json'};
import type {Auth,DecodedIdToken} from 'firebase-admin/auth';
import {createHash} from 'node:crypto';

const authFailure=(code:string)=>Object.assign(new Error(code),{code});
export function accountLookupPermissionFailure(error:any){
 return error?.code==='auth/insufficient-permission'||error?.code==='auth/internal-error'&&/INSUFFICIENT_PERMISSION|PERMISSION_DENIED|firebaseauth\.users\.get/i.test(String(error?.message||''));
}
/** Read only the signed-in user's account; never request arbitrary user IDs. */
export async function lookupFirebaseSession(token:string,decoded:DecodedIdToken,fetcher:typeof fetch=fetch){
 if(decoded.aud!==firebaseConfig.projectId||decoded.iss!==`https://securetoken.google.com/${firebaseConfig.projectId}`||decoded.firebase?.tenant)throw Error('AUTH_SERVER_CONFIG_ERROR');
 let response:Response,body:any;
 try{
  response=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
  body=await response.json();
 }catch{throw Error('AUTH_SERVER_CONFIG_ERROR');}
 if(!response.ok){
  const code=String(body?.error?.message||'').split(' : ')[0];
  if(['USER_DISABLED','USER_NOT_FOUND','INVALID_ID_TOKEN','TOKEN_EXPIRED','TOKEN_REVOKED'].includes(code))throw authFailure('auth/id-token-revoked');
  throw Error('AUTH_SERVER_CONFIG_ERROR');
 }
 const users=body?.users;
 if(!Array.isArray(users)||users.length!==1||users[0]?.localId!==decoded.uid)throw Error('AUTH_SERVER_CONFIG_ERROR');
 const user=users[0];
 if(user.disabled===true)throw authFailure('auth/user-disabled');
 const validSince=Number(user.validSince??0);
 if(!Number.isFinite(validSince)||validSince<0||!Number.isFinite(decoded.auth_time))throw Error('AUTH_SERVER_CONFIG_ERROR');
 if(decoded.auth_time<validSince)throw authFailure('auth/id-token-revoked');
}
// When the Admin SDK may not read accounts (no IAM role), every request used to try that first, fail after a round
// trip, and then do the REST lookup. Remember the missing permission for a while and go straight to the REST lookup;
// it checks disabled/revoked/deleted accounts on every request just the same. Re-tried every 10 minutes in case the
// permission is granted later.
const LOOKUP_RETRY_MS=10*60*1000;
const adminLookupUnavailableUntil=new WeakMap<object,number>();
/** Preserve revoked/disabled checks without requiring a new Admin Auth IAM role. */
async function checkFirebaseSession(auth:Pick<Auth,'verifyIdToken'>,token:string,lookup=lookupFirebaseSession){
 if(Date.now()>=(adminLookupUnavailableUntil.get(auth)||0)){
  try{return await auth.verifyIdToken(token,true);}catch(error){
   if(!accountLookupPermissionFailure(error))throw error;
   adminLookupUnavailableUntil.set(auth,Date.now()+LOOKUP_RETRY_MS);
  }
 }
 // Verify signature, expiry, issuer and audience before using the user REST API.
 const decoded=await auth.verifyIdToken(token,false);
 await lookup(token,decoded);
 return decoded;
}
// Simultaneous requests share verification. A passed check (signature, expiry, disabled/revoked account) is then
// remembered for up to 60 seconds on this server instance, never past the token's own expiry, so moving between
// screens does not ask Google again each time. Trade-off (approved): an account disabled elsewhere can keep an open
// screen for up to a minute; removing or blocking an account here forgets it at once. Roles and workspace access are
// still read on every request by the callers.
const SESSION_MEMORY_MS=60_000,SESSION_MEMORY_MAX=500;
const pendingSessions=new WeakMap<object,Map<string,Promise<DecodedIdToken>>>();
const recentSessions=new Map<string,{auth:object;decoded:DecodedIdToken;until:number}>();
const tokenKey=(token:string)=>createHash('sha256').update(token).digest('hex');
// Bumped by every forget: a check that started before it may not refill the memory, and requests after it never join
// a check started before it (the account is unknown until the token is decoded, so this applies to all accounts).
let forgetGeneration=0;
/** Forget remembered checks for this account (it was removed or its sign-in was blocked). */
export function forgetFirebaseSessions(uid:string){forgetGeneration++;for(const [key,row] of recentSessions)if(row.decoded.uid===uid)recentSessions.delete(key);}
export function verifyFirebaseSession(auth:Pick<Auth,'verifyIdToken'>,token:string,lookup=lookupFirebaseSession){
 if(lookup!==lookupFirebaseSession)return checkFirebaseSession(auth,token,lookup);
 const key=tokenKey(token),now=Date.now(),known=recentSessions.get(key);
 if(known&&known.auth===auth&&known.until>now)return Promise.resolve(known.decoded);
 if(known)recentSessions.delete(key);
 const generation=forgetGeneration,pendingKey=generation+':'+token;
 let pending=pendingSessions.get(auth);if(!pending){pending=new Map();pendingSessions.set(auth,pending);}
 const existing=pending.get(pendingKey);if(existing)return existing;
 const request=checkFirebaseSession(auth,token,lookup);pending.set(pendingKey,request);
 const cleanup=()=>{if(pending!.get(pendingKey)===request)pending!.delete(pendingKey);};request.then(cleanup,cleanup);
 request.then(decoded=>{
  if(generation!==forgetGeneration)return;
  const expires=Number(decoded?.exp)*1000;if(!Number.isFinite(expires))return;
  const until=Math.min(Date.now()+SESSION_MEMORY_MS,expires);if(until<=Date.now())return;
  if(recentSessions.size>=SESSION_MEMORY_MAX)recentSessions.delete(recentSessions.keys().next().value!);
  recentSessions.set(key,{auth,decoded,until});
 },()=>{});
 return request;
}
