import {z} from 'zod';
import {templateManagementList,dryRunTemplates,importTemplateStep,saveTemplate,retryTemplate,resolveTemplate,reconcileTemplateStep,templateHistory,restoreTemplate} from './messageTemplateStore.js';
const cursorSchema=z.string().max(1000).optional();
export async function templateAction(db:any,actor:any,body:any){
 const {action,...input}=body;
 switch(action){
  case 'template-list': {const v=z.object({cursor:z.string().uuid().optional()}).strict().parse(input);return templateManagementList(db,actor,v.cursor);}
  case 'template-dry-run': {const v=z.object({cursor:cursorSchema}).strict().parse(input);return dryRunTemplates(db,actor,v.cursor);}
  case 'template-import-step': z.object({confirmed:z.literal(true)}).strict().parse(input);return importTemplateStep(db,actor);
  case 'template-reconcile-step': z.object({confirmed:z.literal(true)}).strict().parse(input);return reconcileTemplateStep(db,actor);
  case 'template-save': return {record:await saveTemplate(db,actor,input)};
  case 'template-history': {const v=z.object({id:z.string().uuid()}).strict().parse(input);return templateHistory(db,actor,v.id);}
  case 'template-restore': return {record:await restoreTemplate(db,actor,input)};
  case 'template-retry': {const v=z.object({id:z.string().uuid()}).strict().parse(input);return retryTemplate(db,actor,v.id);}
  case 'template-resolve': return {record:await resolveTemplate(db,actor,input)};
  default: throw Error('INVALID_INPUT');
 }
}
