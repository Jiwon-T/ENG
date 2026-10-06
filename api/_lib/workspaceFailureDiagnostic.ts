/** Stable categories only: never log raw SDK messages, paths, tokens or credentials. */
export function workspaceFailureDiagnostic(error:any){
 const message=String(error?.message||'');
 if(/Firestore has already been initialized|initializeFirestore\(\) has already been called/.test(message))return {causeCode:'FIRESTORE_REINITIALIZED'};
 const code=error?.code;
 if(typeof code==='number'&&Number.isInteger(code)&&code>=0&&code<=16)return {causeCode:'FIRESTORE_GRPC_'+code};
 if(typeof code==='string'&&/^(?:auth|app|firestore)\/[a-z-]+$/.test(code))return {causeCode:code};
 if(['permission-denied','failed-precondition','unavailable','deadline-exceeded','resource-exhausted','aborted'].includes(code))return {causeCode:'FIRESTORE_'+code.toUpperCase().replaceAll('-','_')};
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return {causeCode:'UPSTREAM_TIMEOUT'};
 if(message==='fetch failed')return {causeCode:'UPSTREAM_NETWORK'};
 return {causeCode:'UNCLASSIFIED'};
}
