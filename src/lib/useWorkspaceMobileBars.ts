import {useEffect,useState,type RefObject} from 'react';
export function mobileBarsHidden(delta:number,atTop:boolean,keyboard:boolean,previous:boolean){return keyboard?true:atTop?false:delta>8?true:delta< -8?false:previous;}
export function useWorkspaceMobileBars(ref:RefObject<HTMLElement|null>){
 const [state,setState]=useState({mobile:false,hidden:false});
 useEffect(()=>{
  const root=ref.current?.closest<HTMLElement>('.teacher-workspace');if(!root)return;
  let previousY=window.scrollY,baseline=window.innerHeight,previousWidth=window.innerWidth,hidden=false,wasKeyboard=false;
  const update=()=>{if(Math.abs(window.innerWidth-previousWidth)>60){baseline=window.innerHeight;previousWidth=window.innerWidth;}baseline=Math.max(baseline,window.innerHeight);
   const mobile=window.innerWidth<768||root.clientWidth-parseFloat(getComputedStyle(root).paddingLeft)-parseFloat(getComputedStyle(root).paddingRight)<768;
   const keyboard=baseline-(window.visualViewport?.height||window.innerHeight)>150;
   hidden=mobileBarsHidden(window.scrollY-previousY,window.scrollY<8,keyboard,wasKeyboard&&!keyboard?false:hidden);wasKeyboard=keyboard;previousY=window.scrollY;
   setState(old=>old.mobile===mobile&&old.hidden===hidden?old:{mobile,hidden});
   root.classList.toggle('workspace-mobile',mobile);root.classList.toggle('mobile-tabs-hidden',hidden);
  };
  update();const observer=new ResizeObserver(update);observer.observe(root);window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
  return()=>{observer.disconnect();window.removeEventListener('scroll',update);window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);root.classList.remove('workspace-mobile','mobile-tabs-hidden');};
 },[ref]);
 return state;
}
