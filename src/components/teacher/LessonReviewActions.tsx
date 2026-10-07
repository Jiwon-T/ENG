export function canManageLessonReview(viewer:any,record:any){return Boolean(viewer.admin||viewer.uid&&record.ownerUid===viewer.uid);}
export default function LessonReviewActions({allowed,busy,onEdit,onDelete}:{allowed:boolean;busy:boolean;onEdit?:()=>void;onDelete:()=>void}){
 if(!allowed)return null;
 return <div className="lesson-review-actions">{onEdit&&<button type="button" className="primary-button" disabled={busy} onClick={onEdit}>일지 수정</button>}<button type="button" className="small-button" disabled={busy} onClick={onDelete}>일지 삭제</button></div>;
}
