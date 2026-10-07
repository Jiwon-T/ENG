import {Trash2} from 'lucide-react';
import {canManageLessonReview} from './LessonReviewActions';

export default function LessonDeleteButton({viewer,record,busy,onDelete}:{viewer:any;record:any;busy:boolean;onDelete:()=>void}){
 if(!record||record.archived||!canManageLessonReview(viewer,record))return null;
 return <button type="button" className="small-button lesson-delete-button" disabled={busy} onClick={onDelete}><Trash2 size={14} aria-hidden="true"/>일지 삭제</button>;
}
