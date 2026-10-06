import firebaseConfig from '../../firebase-applet-config.json' with {type:'json'};
import type {Auth,DecodedIdToken} from 'firebase-admin/auth';

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
/** Preserve revoked/disabled checks without requiring a new Admin Auth IAM role. */
export async function verifyFirebaseSession(auth:Pick<Auth,'verifyIdToken'>,token:string,lookup=lookupFirebaseSession){
 try{return await auth.verifyIdToken(token,true);}catch(error){
  if(!accountLookupPermissionFailure(error))throw error;
 }
 // Verify signature, expiry, issuer and audience before using the user REST API.
 const decoded=await auth.verifyIdToken(token,false);
 await lookup(token,decoded);
 return decoded;
}
