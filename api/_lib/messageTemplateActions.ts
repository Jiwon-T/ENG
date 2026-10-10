import {z} from 'zod';
import {templateManagementList,saveTemplate,templateHistory,restoreTemplate} from './messageTemplateStore.js';
export async function templateAction(db:any,actor:any,body:any){
 const {action,...input}=body;
 switch(action){
  case 'template-list': {const v=z.object({cursor:z.string().uuid().optional()}).strict().parse(input);return templateManagementList(db,actor,v.cursor);}
  case 'template-save': return {record:await saveTemplate(db,actor,input)};
  case 'template-history': {const v=z.object({id:z.string().uuid()}).strict().parse(input);return templateHistory(db,actor,v.id);}
  case 'template-restore': return {record:await restoreTemplate(db,actor,input)};
  default: throw Error('INVALID_INPUT');
 }
}
