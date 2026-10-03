export function teacherTestProperties(data:any) {
 return {
  '단어':{number:data.total??null},
  '틀린 단어':{number:data.total==null?null:data.total-data.correct},
  '문항 수':{number:data.examTotal??null},
  '오답 수':{number:data.examTotal==null?null:data.examTotal-data.examCorrect},
 };
}
