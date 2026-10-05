/** Only accept webhook URLs from trusted Notion transmission properties. */
export function teacherMakeTrigger(page:any, names=['전송하기','전송','반영 요청']) {
 for(const name of names){const p=page.properties?.[name];const values=[p?.formula?.string,p?.url,...(p?.rich_text||[]).flatMap((t:any)=>[t.href,t.text?.link?.url,t.plain_text,t.text?.content])];
  for(const value of values){if(typeof value!=='string')continue;const matches=value.match(/https:\/\/hook\.(?:eu|us)\d+\.make\.com\/[^\s"<>\)\]]+/g)||[];
   for(const raw of matches){try{const url=new URL(raw);if(url.protocol==='https:'&&/^hook\.(?:eu|us)\d+\.make\.com$/.test(url.hostname)&&!url.username&&!url.password&&/^\/[a-zA-Z0-9]+$/.test(url.pathname))return url.href;}catch{}}
  }
 }
 return null;
}
