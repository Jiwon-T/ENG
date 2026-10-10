// Reference workbook: 14pt body, 21pt lines; Excel permits at most 409pt per row.
export const lessonExcelWidths=[22.83203125,32.58203125,31.08203125,39.5,29.75,33.58203125];
export const lessonExcelFontSizes=[14,14,14,14,14,11];
const lineHeight=(font:number)=>font*1.5;
function glyphWidth(ch:string,font:number){const code=ch.codePointAt(0)!;const width=ch==='\t'?4:code>=0x300&&code<=0x36f?0:code>255?2:/[MW@%]/.test(ch)?1.4:/[il.,'!|]/.test(ch)?0.5:1;return width*font/11*1.08;}
/** Split only at row/cell limits; concatenating parts preserves every original character. */
export function excelTextParts(value:string,width:number,font=14):string[]{
 const capacity=Math.max(1,width-2),maxLines=Math.floor((409-6)/lineHeight(font));
 const parts:string[]=[];let part='',lineWidth=0,lines=1;
 for(const ch of value.replace(/\r\n/g,'\n').replace(/\r/g,'\n')){
  const size=ch==='\n'?0:glyphWidth(ch,font),wrap=ch!=='\n'&&lineWidth>0&&lineWidth+size>capacity;
  if(part.length+ch.length>32767||((ch==='\n'||wrap)&&lines===maxLines)){parts.push(part);part='';lineWidth=0;lines=1;}
  if(ch==='\n'){lines++;lineWidth=0;}else{if(lineWidth>0&&lineWidth+size>capacity){lines++;lineWidth=0;}lineWidth+=size;}
  part+=ch;
 }
 parts.push(part);return parts;
}
/** Lines Excel shows for wrapped text. Excel breaks at spaces, so a word that does not fit moves whole to the next line;
 *  only a word longer than the cell breaks by character. Counting by character alone left rows too short. */
export function excelTextLines(value:string,width:number,font=14){
 const capacity=Math.max(1,width-2.5);let lines=0;
 for(const paragraph of value.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')){
  lines++;let used=0;
  for(const word of paragraph.split(/(?<= )/)){
   const size=[...word].reduce((n,ch)=>n+glyphWidth(ch,font),0),core=size-(word.endsWith(' ')?glyphWidth(' ',font):0);
   if(used>0&&used+core>capacity){lines++;used=0;}
   if(core>capacity){for(const ch of word){const w=glyphWidth(ch,font);if(used>0&&used+w>capacity){lines++;used=0;}used+=w;}}else used+=size;
  }
 }
 return Math.max(1,lines);
}
export function lessonExcelRowHeight(values:string[],widths=lessonExcelWidths){return Math.min(409,Math.max(21,...values.map((v,i)=>excelTextLines(v,widths[i],lessonExcelFontSizes[i])*lineHeight(lessonExcelFontSizes[i])+10)));}
