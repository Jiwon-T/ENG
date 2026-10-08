const modes:Record<string,string>={quiz:'객관식 퀴즈',flashcard:'플래시카드',match:'매치 게임',conjugation:'3단 변화',test:'단어 테스트'};
const date=(v:string|null)=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'날짜 미상';
export default function TeacherOnlineLearning({data,page,onPrevious,onNext,loading}:any){
 if(!data)return <p role="status">온라인 학습 기록을 불러오는 중…</p>;
 const reasons:Record<string,string>={'account-not-linked':'학생 앱 계정이 연결되지 않아 온라인 학습 이력을 조회할 수 없습니다.','account-link-mismatch':'학생 계정 연결을 확인해야 합니다. 다른 계정의 기록은 표시하지 않습니다.','subject-not-available':'온라인 단어·문법 학습 기록은 영어 담당 범위에서 확인할 수 있습니다.'};
 if(data.reason)return <p role="status" className="text-sm py-3">{reasons[data.reason]||'온라인 기록을 확인할 수 없습니다.'}</p>;
 return <div className="review-section"><h3>온라인 학습 · 읽기 전용</h3><p className="text-xs mb-3">학생 앱에 저장된 학습 이력입니다. 완료·오답·포인트 상태는 변경하지 않습니다.</p>
  {data.progress&&<p className="text-sm mb-3">학습 단어 기록 {data.progress.recorded}개 · 암기 완료 {data.progress.learned}개</p>}
  <h4 className="font-bold text-sm">학습 활동</h4>{!data.sessions.length&&<p className="text-xs py-3">저장된 온라인 학습 활동이 없습니다.</p>}
  {data.sessions.map((s:any)=><article key={s.id} className="review-row"><strong>{s.wordbookTitle} · {modes[s.type]||s.type||'학습'}</strong><p className="text-xs">{date(s.createdAt)} · {s.category==='grammar'?'문법':s.category==='exam'?'시험 대비':'단어'}{s.dayStart!==null&&` · 범위 ${s.dayStart}${s.dayEnd!==null&&s.dayEnd!==s.dayStart?'–'+s.dayEnd:''}`} · {s.duration??'—'}초{s.score!==null&&` · 정답 ${s.score}/${s.totalItems??'—'}`}</p>
   {s.incorrectCount>0&&<details className="mt-2"><summary>오답 {s.incorrectCount}개 확인</summary>{s.incorrectAnswers.map((a:any,i:number)=><div key={i} className="text-xs py-2"><strong>{a.word}</strong> {a.meaning}{a.quizSentence&&<p>{a.quizSentence}</p>}<p>선택: {a.userChoice||'미선택'} · 정답: {a.correctAnswer} · {a.isReviewed?'복습 확인됨':'복습 미확인'}</p></div>)}{s.incorrectCount>s.incorrectAnswers.length&&<p className="text-xs">오답이 많아 이번 기록의 앞 {s.incorrectAnswers.length}개를 표시합니다.</p>}</details>}
  </article>)}
  <div className="review-pagination"><button type="button" disabled={loading||page===0} onClick={onPrevious}>이전</button><span>{page+1}페이지</span><button type="button" disabled={loading||!data.nextCursor} onClick={onNext}>다음</button></div>
  <h4 className="font-bold text-sm mt-4">앱 과제 · 최근 10개</h4>{data.assignments.map((a:any)=><article key={a.id} className="review-row"><p className="text-xs">{date(a.createdAt)} · {a.isDone?'완료':'미완료'}</p><p className="whitespace-pre-wrap">{a.content}</p></article>)}{!data.assignments.length&&<p className="text-xs py-3">앱 과제가 없습니다. 수업 일지 과제는 수업 기록에서 확인할 수 있습니다.</p>}
 </div>;
}
