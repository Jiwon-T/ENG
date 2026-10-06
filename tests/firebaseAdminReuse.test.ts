import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {getApps,deleteApp,initializeApp} from 'firebase-admin/app';
const keys=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIRESTORE_DATABASE_ID'];
async function fixture(run:()=>Promise<void>){
 const before=new Map(keys.map(key=>[key,process.env[key]])),apps=new Set(getApps().map(app=>app.name));
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 Object.assign(process.env,{FIREBASE_PROJECT_ID:'local-initialization-test',FIREBASE_CLIENT_EMAIL:'test@example.invalid',FIREBASE_PRIVATE_KEY:privateKey,FIRESTORE_DATABASE_ID:'named-test-database'});
 try{await run();}finally{for(const [key,value]of before)value===undefined?delete process.env[key]:process.env[key]=value;await Promise.all(getApps().filter(app=>!apps.has(app.name)).map(deleteApp));}
}
test('real Firebase SDK shares initialized database across separately evaluated server modules',async()=>fixture(async()=>{
 const first=await import(new URL('../api/_lib/firebaseAdmin.ts?instance=first',import.meta.url).href),second=await import(new URL('../api/_lib/firebaseAdmin.ts?instance=second',import.meta.url).href);
 const initial=first.getFirebaseAdmin();assert.throws(()=>initial.db.settings({ignoreUndefinedProperties:true}),/already been initialized/);
 const reused=second.getFirebaseAdmin();assert.equal(reused.db,initial.db);assert.equal(reused.auth,initial.auth);assert.equal(reused.db.databaseId,'named-test-database');
 assert.deepEqual(await Promise.all(Array.from({length:8},async()=>second.getFirebaseAdmin().db)),Array(8).fill(initial.db));
}));
test('foreign default app is not adopted and named database configurations stay isolated',async()=>fixture(async()=>{
 initializeApp({projectId:'foreign-project'});
 const module=await import(new URL('../api/_lib/firebaseAdmin.ts?instance=isolation',import.meta.url).href),initial=module.getFirebaseAdmin();assert.equal(initial.auth.app.options.projectId,'local-initialization-test');
 process.env.FIRESTORE_DATABASE_ID='second-named-database';const other=module.getFirebaseAdmin();assert.notEqual(other.db,initial.db);assert.equal(other.auth,initial.auth);assert.equal(other.db.databaseId,'second-named-database');
 process.env.FIRESTORE_DATABASE_ID='named-test-database';assert.equal(module.getFirebaseAdmin().db,initial.db);
}));
test('cached connection never bypasses required environment configuration',async()=>fixture(async()=>{
 const module=await import(new URL('../api/_lib/firebaseAdmin.ts?instance=config',import.meta.url).href);module.getFirebaseAdmin();delete process.env.FIRESTORE_DATABASE_ID;assert.throws(()=>module.getFirebaseAdmin(),/CONFIG_ERROR/);
}));
