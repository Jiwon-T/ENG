import {applicationDefault,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
let connection:ReturnType<typeof getFirestore>|undefined;
export function templateWorkerFirestore(){
 if(connection)return connection;
 const projectId=process.env.FIREBASE_PROJECT_ID,databaseId=process.env.FIRESTORE_DATABASE_ID;
 if(!projectId||!databaseId)throw Error('CONFIG_ERROR');
 // Cloud Run service identity/ADC. Never copy the web app's private key into the worker.
 const name='template-worker',app=getApps().find(a=>a.name===name)||initializeApp({projectId,credential:applicationDefault()},name);
 connection=getFirestore(app,databaseId);connection.settings({ignoreUndefinedProperties:true});return connection;
}
