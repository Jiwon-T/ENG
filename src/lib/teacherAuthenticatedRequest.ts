import { safeFetchJson } from './safeFetchJson';

interface TeacherAuth {
  authStateReady(): Promise<void>;
  currentUser: { uid?:string;getIdToken(forceRefresh?: boolean): Promise<string> } | null;
}
const quotaPauses=new WeakMap<TeacherAuth,{user:object;until:number;data:any;message:string}>();

// All teacher screens wait for Firebase restoration and retry an expired token once.
export async function teacherAuthenticatedRequest<T>(auth: TeacherAuth, endpoint: string, init: RequestInit = {},expectedUid?:string) {
  const initial=auth.currentUser;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 인증이 만료되었습니다. 다시 로그인해 주세요.');
  const sameUser=(candidate:TeacherAuth['currentUser'])=>candidate===user||Boolean(user.uid&&candidate?.uid===user.uid);
  if(initial&&!sameUser(initial)||expectedUid&&user.uid&&user.uid!==expectedUid)throw new Error('로그인 계정이 변경되었습니다.');
  const pause=quotaPauses.get(auth);
  if(pause?.user===user&&pause.until>Date.now())return {ok:false,status:429,error:'FIRESTORE_RESOURCE_EXHAUSTED',data:pause.data as T,userMessage:pause.message};
  if(pause)quotaPauses.delete(auth);
  const send = async (refresh = false) => {
    const headers = new Headers(init.headers);
    const token=await user.getIdToken(refresh);if(!sameUser(auth.currentUser))throw new Error('로그인 계정이 변경되었습니다.');
    headers.set('Authorization', `Bearer ${token}`);
    return safeFetchJson<T>(endpoint, { ...init, headers, cache: 'no-store' });
  };
  let result = await send();
  if(!sameUser(auth.currentUser))throw new Error('로그인 계정이 변경되었습니다.');
  if (result.status === 401 && result.error === 'UNAUTHORIZED') result = await send(true);
  if(!sameUser(auth.currentUser))throw new Error('로그인 계정이 변경되었습니다.');
  if(result.error==='FIRESTORE_RESOURCE_EXHAUSTED'){
    const body=result.data as any;
    quotaPauses.set(auth,{user,until:Date.now()+30_000,message:result.userMessage,data:{ok:false,error:'FIRESTORE_RESOURCE_EXHAUSTED',message:result.userMessage,diagnosticId:body?.diagnosticId}});
  }
  return result;
}

export function reportReviewError(result: { status: number; error?: string; userMessage: string; data: any }) {
  const messages: Record<string, string> = {
    UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.',
    SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.',
    FORBIDDEN: '담당 학생 또는 소속 학원의 리포트만 확인할 수 있습니다.',
    SERVER_CONFIG_ERROR: '서버 연결 설정을 확인해야 합니다.',
    REPORT_INDEX_REQUIRED: '리포트 조회에 필요한 서버 인덱스 설정을 확인해야 합니다.',
    NETWORK_ERROR: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  };
  const message = messages[result.error || ''] || result.data?.message || result.userMessage || '리포트를 불러오지 못했습니다. 다시 시도해 주세요.';
  return `${message}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`;
}

export function isReportReviewResponse(value: any) {
  return value?.ok === true && Array.isArray(value.reports) && Array.isArray(value.schedules)
    && ['records', 'subjects', 'academyScores'].every(key => Array.isArray(value.academic?.[key]));
}
