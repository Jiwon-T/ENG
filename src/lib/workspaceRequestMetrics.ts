/** Development only. No parameters, identities, student data or browser storage. */
export interface WorkspaceRequestMetric {action:string;started:number;elapsed?:number;ok?:boolean}
const measurements:WorkspaceRequestMetric[]=[];
export function beginWorkspaceRequest(action:string){
 const item:WorkspaceRequestMetric={action,started:performance.now()};
 measurements.push(item);if(measurements.length>200)measurements.shift();return item;
}
export function finishWorkspaceRequest(item:WorkspaceRequestMetric,ok:boolean){item.elapsed=performance.now()-item.started;item.ok=ok;}
export const workspaceRequestMetrics=()=>measurements.map(item=>({...item}));
export const clearWorkspaceRequestMetrics=()=>{measurements.length=0;};
