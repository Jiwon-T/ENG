import { passageCall } from '../../lib/passageApi';
import WorkbookMaker from '../teacher/WorkbookMaker';

// 워크북 만들기 (학생): the same maker as the teachers', its history kept per account through the passage API; after the
// Word file, the student can ask the teacher to check the printed workbook (선생님 인증).
const request = (action?: string, body?: any) => passageCall<any>(action === 'read:workbook-history' ? 'workbook-history' : String(action || ''), body);

export default function StudentWorkbook() {
  return <div className="mx-auto max-w-4xl px-4 pb-10 pt-4 md:px-6 md:pt-8"><WorkbookMaker request={request} /></div>;
}
