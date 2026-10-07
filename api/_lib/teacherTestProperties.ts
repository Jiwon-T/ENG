export function teacherTestProperties(data:any) {
 return {
  '단어':{number:data.total??null},
  '틀린 단어':{number:data.total==null?null:data.wrong??data.total-data.correct},
  '문항 수':{number:data.examTotal??null},
  '오답 수':{number:data.examTotal==null?null:data.examWrong??data.examTotal-data.examCorrect},
 };
}
/** Read the same raw counts written above; do not use calculated percentage formulas. */
export function teacherTestValues(properties:any) {
 const count=(name:string)=>properties?.[name]?.number??null;
 const total=count('단어'),wrong=count('틀린 단어'),examTotal=count('문항 수'),examWrong=count('오답 수');
 return {total,wrong,correct:total===null||wrong===null?null:total-wrong,examTotal,examWrong,examCorrect:examTotal===null||examWrong===null?null:examTotal-examWrong};
}
