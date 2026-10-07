import {useState} from 'react';
import {clearWorkspaceRequestMetrics,workspaceRequestMetrics} from '../../lib/workspaceRequestMetrics';
export default function WorkspaceRequestMetrics(){
 const [items,setItems]=useState(workspaceRequestMetrics);
 return <details className="workspace-request-metrics"><summary>개발용 요청 측정</summary><button type="button" className="small-button" onClick={()=>setItems(workspaceRequestMetrics())}>측정 갱신</button><button type="button" className="small-button" onClick={()=>{clearWorkspaceRequestMetrics();setItems([]);}}>측정 초기화</button><p>래퍼 호출 {items.length}회 · 완료 {items.filter(item=>item.elapsed!==undefined).length}회</p><ul>{items.map((item,index)=><li key={index}>{item.action} · {item.elapsed===undefined?'진행 중':`${item.elapsed.toFixed(1)}ms`} · {item.ok===undefined?'대기':item.ok?'응답 완료':'실패'}</li>)}</ul></details>;
}
