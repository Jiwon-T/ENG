export function examPeriod(value:any) {
 const title=String(value.title||'');
 const semester=value.semester??Number(title.match(/([12])\s*학기/)?.[1]||title.match(/-([12])\s*(?:중간|기말)/)?.[1]||0);
 const period=value.examPeriod||(title.includes('중간')?'중간고사':title.includes('기말')?'기말고사':'');
 const year=value.examYear||Number(String(value.examDate||'').slice(0,4));
 return value.examType==='학교 내신'&&year&&[1,2].includes(semester)&&period?{year,semester,period,key:`${year}-${semester}-${period}`,label:`${String(year).slice(-2)}년도 ${semester}학기 ${period}`}:null;
}
