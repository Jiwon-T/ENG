import {useLayoutEffect,useRef} from 'react';
export function textareaHeight(line:number,padding:number,border:number,content:number,minRows=2,maxRows=8){
 return Math.min(line*maxRows+padding+border,Math.max(line*minRows+padding+border,content+border));
}
export function useAutoGrowTextarea(value:unknown,minRows=2,maxRows=8){
 const ref=useRef<HTMLTextAreaElement>(null);
 const resize=()=>{const node=ref.current;if(!node||!node.clientWidth)return;
  const css=getComputedStyle(node),line=parseFloat(css.lineHeight)||20,padding=parseFloat(css.paddingTop)+parseFloat(css.paddingBottom),border=parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth);
  const minimum=parseFloat(css.getPropertyValue('--textarea-min-rows'))||minRows,maximum=parseFloat(css.getPropertyValue('--textarea-max-rows'))||maxRows;
  node.style.height='0px';const height=textareaHeight(line,padding,border,node.scrollHeight,minimum,maximum);node.style.height=`${height}px`;node.style.overflowY=node.scrollHeight>height?'auto':'hidden';
 };
 useLayoutEffect(resize,[value,minRows,maxRows]);
 useLayoutEffect(()=>{const node=ref.current;if(!node||typeof ResizeObserver==='undefined')return;let width=node.clientWidth;
  const observer=new ResizeObserver(()=>{if(node.clientWidth!==width){width=node.clientWidth;resize();}});observer.observe(node);return()=>observer.disconnect();
 },[]);
 return ref;
}
