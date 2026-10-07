import {ClipboardList,CalendarDays,Users,BookOpen,Settings} from 'lucide-react';
export const NAV_ITEMS=[
 {id:'lesson',label:'수업 일지 작성',icon:ClipboardList,group:0,mobilePrimary:true,mobileOrder:0},
 {id:'academy',label:'일지 조회',icon:ClipboardList,group:0,mobilePrimary:true,mobileOrder:3},
 {id:'schedule',label:'시간표·일정',icon:CalendarDays,group:0,mobilePrimary:true,mobileOrder:1},
 {id:'students',label:'학생 관리',icon:Users,group:1,mobilePrimary:true,mobileOrder:2},
 {id:'academic',label:'성적 관리',icon:BookOpen,group:1,mobilePrimary:false,mobileOrder:99},
 {id:'curriculum',label:'커리큘럼',icon:BookOpen,group:2,mobilePrimary:false,mobileOrder:99},
 {id:'word',label:'학습 세트',icon:BookOpen,group:2,mobilePrimary:false,mobileOrder:99},
 {id:'settings',label:'관리자 설정',icon:Settings,group:2,mobilePrimary:false,mobileOrder:99},
] as const;
export function visibleWorkspaceNav(admin=false,principal=false){return NAV_ITEMS.filter(item=>item.id!=='settings'||admin||principal);}
export function adjacentWorkspaceTab(items:readonly {id:string}[],current:string,key:string){const index=Math.max(0,items.findIndex(item=>item.id===current));return key==='Home'?items[0]?.id:key==='End'?items.at(-1)?.id:key==='ArrowRight'?items[(index+1)%items.length]?.id:key==='ArrowLeft'?items[(index+items.length-1)%items.length]?.id:undefined;}
