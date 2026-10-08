import {useState} from 'react';
import StatCard from '../reports/StatCard';
import ScoreTile from '../reports/ScoreTile';
import SessionRow from '../reports/SessionRow';
import StatusBadge from './StatusBadge';
import {testPercentage,reportScoreTone,sessionMatches} from '../../lib/teacherReportPresentation';
const modes:Record<string,string>={quiz:'객관식 퀴즈',flashcard:'플래시카드',match:'매치 게임',conjugation:'3단 변화',test:'단어 테스트'};
const date=(v:string|null)=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'날짜 미상';
export default function TeacherOnlineLearning({data,page,onPrevious,onNext,loading}:any){
 const [filter,setFilter]=useState('all');
 if(!data)return <p role="status">온라인 학습 기록을 불러오는 중…</p>;
 const reasons:Record<string,string>={'account-not-linked':'학생 앱 계정이 연결되지 않아 온라인 학습 이력을 조회할 수 없습니다.','account-link-mismatch':'학생 계정 연결을 확인해야 합니다. 다른 계정의 기록은 표시하지 않습니다.','subject-not-available':'온라인 단어·문법 학습 기록은 영어 담당 범위에서 확인할 수 있습니다.'};
 if(data.reason)return <p role="status" className="text-sm py-3">{reasons[data.reason]||'온라인 기록을 확인할 수 없습니다.'}</p>;
 const loadedTests=data.sessions.filter((s:any)=>s.type==='test').map((s:any)=>({...s,percentage:testPercentage(s.score,s.totalItems)}));
 const tests=loadedTests.filter((s:any)=>s.percentage!==null);
 const latest=[...loadedTests].sort((a:any,b:any)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]?.percentage??null;
 const average=tests.length?Math.round(tests.reduce((sum:number,s:any)=>sum+s.percentage,0)/tests.length*10)/10:null;
 return <div className="review-section report-online"><h3>온라인 학습 · 읽기 전용</h3><p className="text-xs mb-3">학생 앱에 저장된 학습 이력입니다. 완료·오답·포인트 상태는 변경하지 않습니다.</p>
  <div className="report-stats"><StatCard label="학습 단어 기록" value={`${data.progress?.recorded??'—'}개`}/><StatCard label="암기 완료" value={`${data.progress?.learned??'—'}개`}/><StatCard label="최근 단어 테스트 점수" value={latest===null?'—':`${latest}%`}/><StatCard label="평균" value={average===null?'—':`${average}%`}/></div><p className="report-caption">현재 불러온 단어 테스트 {loadedTests.length}회 기준 · 평균은 점수를 계산할 수 있는 {tests.length}회</p>
  {tests.length>=2&&<svg viewBox="0 0 400 70" role="img" aria-label="현재 불러온 단어 테스트 점수 추이" className="report-sparkline">{[...tests].reverse().map((s:any,i:number)=><rect key={s.id} x={i*400/tests.length+4} y={65-s.percentage*.6} width={400/tests.length-8} height={s.percentage*.6} fill="currentColor"><title>{s.percentage}%</title></rect>)}</svg>}
  <div className="report-filter-chips" role="group" aria-label="현재 페이지 학습 유형">{[['all','전체'],['test','단어 테스트'],['quiz','퀴즈'],['flashcard','플래시카드'],['grammar','문법'],['exam','시험 대비']].map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div><p className="report-caption">필터는 현재 불러온 페이지에만 적용됩니다.</p>
  <h4 className="font-bold text-sm">학습 활동</h4>{!data.sessions.length&&<p className="text-xs py-3">저장된 온라인 학습 활동이 없습니다.</p>}
  {data.sessions.filter((s:any)=>sessionMatches(s,filter)).map((s:any)=>{const percent=testPercentage(s.score,s.totalItems),seconds=typeof s.duration==='number'?Math.max(0,Math.round(s.duration)):null;return <SessionRow key={s.id} test={s.type==='test'} title={s.wordbookTitle} range={s.dayStart==null?'':s.dayStart===s.dayEnd?`Day ${s.dayStart}`:`범위 ${s.dayStart}${s.dayEnd==null?'':'–'+s.dayEnd}`} meta={`${modes[s.type]||s.type||'학습'} · ${s.category==='grammar'?'문법':s.category==='exam'?'시험 대비':'단어'} · ${date(s.createdAt)}`} score={<div className="report-session-score"><span>{seconds===null?'—':`${Math.floor(seconds/60)}분 ${seconds%60}초`}</span><span>정답 {s.score??'—'}/{s.totalItems??'—'}</span><ScoreTile value={percent} tone={reportScoreTone(percent)} label={percent!==null&&percent<70?'복습 필요':'학습 점수'}/></div>}>
   {s.incorrectCount>0&&<details className="report-wrong"><summary>오답 {s.incorrectCount}개 확인</summary>{s.incorrectAnswers.map((a:any,i:number)=><div key={i}><strong>{a.word}</strong> {a.meaning}{a.quizSentence&&<p>{a.quizSentence}</p>}<p><span className="report-answer status-danger">선택: {a.userChoice||'미선택'}</span> <span className="report-answer status-success">정답: {a.correctAnswer}</span> · {a.isReviewed?'복습 확인됨':'복습 미확인'}</p></div>)}{s.incorrectCount>s.incorrectAnswers.length&&<p>오답이 많아 이번 기록의 앞 {s.incorrectAnswers.length}개를 표시합니다.</p>}</details>}
  </SessionRow>;})}
  <div className="review-pagination"><button type="button" disabled={loading||page===0} onClick={onPrevious}>이전</button><span>{page+1}페이지</span><button type="button" disabled={loading||!data.nextCursor} onClick={onNext}>다음</button></div>
  <h4 className="font-bold text-sm mt-4">앱 과제 · 최근 10개</h4>{data.assignments.map((a:any)=><article key={a.id} className="report-assignment"><p className="text-xs">{date(a.createdAt)} <StatusBadge kind={a.isDone?'done':'saved'} text={a.isDone?'완료':'미완료'}/></p><p className="whitespace-pre-wrap">{a.content}</p></article>)}{!data.assignments.length&&<p className="text-xs py-3">앱 과제가 없습니다. 수업 일지 과제는 수업 기록에서 확인할 수 있습니다.</p>}
 </div>;
}
