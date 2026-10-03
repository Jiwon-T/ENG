export function assertTeacherSettingsAccess(actor:any,value:any,target:any,user:any,memberships:any[]) {
 if(actor.admin)return;
 if(!actor.principal||value.academyId!==actor.academyId||!target||target.disabled||target.academyId!==actor.academyId)throw new Error('FORBIDDEN');
 // A principal manages teaching assignments, never account roles or another academy.
 if(value.workspaceRole!==target.workspaceRole||user.role!==(target.workspaceRole==='principal'?'principal':'teacher'))throw new Error('FORBIDDEN');
 if(memberships.some(m=>!m||m.disabled||m.academyId!==actor.academyId))throw new Error('FORBIDDEN');
}
