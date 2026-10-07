import {z} from 'zod';
import {validLessonDay} from '../../src/lib/lessonReview.js';
function visibilityRef(db:any,uid:string,date:string){if(!validLessonDay(date))throw Error('INVALID_INPUT');return db.collection('teacherTodayVisibility').doc(`${uid}:${date}`);}
export async function readTodayVisibility(db:any,uid:string,date:string){return (await visibilityRef(db,uid,date).get()).data()?.hidden||[];}
export async function changeTodayVisibility(db:any,uid:string,input:any){
 const value=z.object({date:z.string(),eventId:z.string().min(1).max(256).optional(),restore:z.boolean().optional()}).strict().parse(input);
 if(!value.restore&&!value.eventId)throw Error('INVALID_INPUT');
 const ref=visibilityRef(db,uid,value.date);
 return db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();const hidden=value.restore?[]:[...new Set([...(old?.hidden||[]),value.eventId])];
 tx.set(ref,{ownerUid:uid,date:value.date,hidden,updatedAt:Date.now()});return hidden;});
}
