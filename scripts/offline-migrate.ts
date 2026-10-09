import {config} from 'dotenv';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getFirebaseAdmin} from '../api/_lib/firebaseAdmin.js';
import {gradeNotion} from '../api/_lib/teacherAcademicNotion.js';
import {configureMigrationBatch,migrationReadOnlyTransport} from '../api/_lib/migrationTransport.js';
import {offlineKinds,runOfflineMigration,safeMigrationCode,type OfflineKind} from '../api/_lib/offlineMigration.js';
export function parseMigrationArgs(args:string[]){const values:Record<string,string>={},flags=new Set<string>();
 for(let i=0;i<args.length;i++){const a=args[i];if(['--apply','--confirm','--help'].includes(a)){flags.add(a);continue;}
  if(!['--env-file','--project','--database','--kinds','--batch'].includes(a)||!args[i+1]||args[i+1].startsWith('--'))throw Error('INVALID_ARGUMENT');values[a]=args[++i];}
 const kinds=(values['--kinds']||offlineKinds.join(',')).split(',') as OfflineKind[];
 if(kinds.some(k=>!offlineKinds.includes(k)))throw Error('INVALID_KIND');
 const batch=Number(values['--batch']||50);if(!Number.isInteger(batch)||batch<1||batch>100)throw Error('INVALID_BATCH_SIZE');
 if(flags.has('--apply')&&(!flags.has('--confirm')||!values['--project']||!values['--database']))throw Error('APPLY_CONFIRM_REQUIRED');
 return {apply:flags.has('--apply'),help:flags.has('--help'),envFile:values['--env-file'],project:values['--project'],database:values['--database'],kinds:[...new Set(kinds)],batch};
}
async function main(){const options=parseMigrationArgs(process.argv.slice(2));if(options.help){console.log('npx tsx scripts/offline-migrate.ts [--env-file PATH] [--kinds templates,directory,managed,academic,schedules,lessons] [--batch 50] [--apply --confirm --project ID --database ID]');return;}
 if(options.envFile)config({path:resolve(options.envFile),quiet:true});
 for(const name of ['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIRESTORE_DATABASE_ID','NOTION_INTEGRATION_TOKEN','ADMIN_UID'])if(!process.env[name])throw Error('MIGRATION_CONFIG_REQUIRED');
 if(options.project&&options.project!==process.env.FIREBASE_PROJECT_ID||options.database&&options.database!==process.env.FIRESTORE_DATABASE_ID)throw Error('TARGET_MISMATCH');
 const {db,auth}=getFirebaseAdmin(),uid=process.env.ADMIN_UID!;
 const profile=await db.collection('teacherWorkspaceAccess').doc(uid).get();
 // A service account without Firebase Auth read permission falls back to the workspace profile, which must exist.
 let user:any=null;try{user=await auth.getUser(uid);}catch(e:any){if((e?.errorInfo?.code||e?.code)!=='auth/insufficient-permission')throw e;console.log(JSON.stringify({status:'warning',code:'AUTH_LOOKUP_SKIPPED'}));}
 if(!profile.exists||user?.disabled||profile.data()?.disabled||profile.data()?.academyId&&profile.data()?.academyId!=='main')throw Error('FORBIDDEN');
 let stopped=false;process.once('SIGINT',()=>{stopped=true;});process.once('SIGTERM',()=>{stopped=true;});
 const notion=configureMigrationBatch(migrationReadOnlyTransport(gradeNotion),options.batch);
 const result=await runOfflineMigration(db,{uid,admin:true,principal:false,academyId:'main',scopes:[]},{apply:options.apply,kinds:options.kinds,notion,stopped:()=>stopped,emit:v=>console.log(JSON.stringify(v))});
 console.log(JSON.stringify(result));if(result.stopped||result.results.some(r=>['blocked','review-required'].includes(r.status)))process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(JSON.stringify({ok:false,error:setupErrorCode(e)}));process.exitCode=1;});
/** Setup failures name their cause (e.g. CONFIG_ERROR, AUTH_INSUFFICIENT_PERMISSION) without any configuration value. */
export function setupErrorCode(e:any){const code=safeMigrationCode(e);if(code!=='MIGRATION_FAILED')return code;
 const lib=String(e?.errorInfo?.code||e?.code||'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60);
 return lib||(/^CONFIG_ERROR/.test(String(e?.message||''))?'CONFIG_ERROR':'MIGRATION_FAILED');}
