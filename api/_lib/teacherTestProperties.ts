export function teacherTestProperties(data:any) {
 return {
  '단어':{number:data.total??null},
  '틀린 단어':{number:data.total==null?null:data.wrong??data.total-data.correct},
  '문항 수':{number:data.examTotal??null},
  '오답 수':{number:data.examTotal==null?null:data.examWrong??data.examTotal-data.examCorrect},
 };
}
