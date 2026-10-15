// The student's grade from the school written in the display name (no other imports: the server uses it too).
export const GRADE_ORDER=['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3'];

/** Grade from the school in the display name: '전수현 (평여중1)' -> '중1'. */
export function gradeOf(displayName:string):string|null{
 const school=displayName.match(/\(([^)]*)\)\s*$/)?.[1]||'';
 // The level right before the grade number at the end ('고덕중2' -> 중2, '중앙초3' -> 초3), never a letter earlier in the school name.
 const m=school.match(/(초|중|고)(?:등학교|학교)?\s*([1-6])\s*(?:학년)?\s*$/);return m&&GRADE_ORDER.includes(m[1]+m[2])?m[1]+m[2]:null;
}
