import {z} from 'zod';
const status=z.number().int().min(200).max(299);
const responseSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('status'),status}).strict(),
 z.object({kind:z.literal('text'),status,equals:z.string().min(1).max(1000)}).strict(),
 z.object({kind:z.literal('json'),status,path:z.array(z.string().min(1).max(100).refine(s=>!['__proto__','prototype','constructor'].includes(s))).min(1).max(8),equals:z.union([z.string().max(1000),z.number(),z.boolean()])}).strict(),
]);
const parameter=(value:string)=>Boolean(value&&value===value.trim()&&value.length<=100&&!/[\u0000-\u001f\u007f]/.test(value));
export function batiConfig(){
 let url:URL,response:z.infer<typeof responseSchema>;
 try{url=new URL(process.env.BATI_WEBHOOK_URL||'');response=responseSchema.parse(JSON.parse(process.env.BATI_RESPONSE_RULE||''));}catch{throw Error('MESSAGE_CONFIG_REQUIRED');}
 const bodyKey=process.env.BATI_MESSAGE_PARAM||'',recipientKey=process.env.BATI_RECIPIENT_PARAM||'',method=process.env.BATI_WEBHOOK_METHOD||'';
 const headerName=process.env.BATI_SECURITY_HEADER_NAME||'',headerValue=process.env.BATI_SECURITY_HEADER_VALUE||'',payloadMode=process.env.BATI_PAYLOAD_MODE||'';
 if(url.protocol!=='https:'||url.hostname!=='app.bati.ai'||!/^\/webhook\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)||url.username||url.password||url.search||url.hash||!parameter(bodyKey)||!parameter(recipientKey)||bodyKey===recipientKey||!['GET','POST_JSON'].includes(method)||!['body-only','legacy-student'].includes(payloadMode)||payloadMode==='legacy-student'&&(bodyKey!=='내용'||recipientKey!=='보호자연락처'||method!=='GET')||Boolean(headerName)!==Boolean(headerValue)||headerName&&!/^[A-Za-z0-9-]+$/.test(headerName)||/[\r\n]/.test(headerValue)||['host','content-type','content-length','cookie'].includes(headerName.toLowerCase()))throw Error('MESSAGE_CONFIG_REQUIRED');
 return {url,bodyKey,recipientKey,method:method as 'GET'|'POST_JSON',response,headerName,headerValue,payloadMode};
}
export function batiReadiness(){try{const config=batiConfig();return {configured:true,method:config.method,payloadMode:config.payloadMode,responseRuleConfigured:true};}catch{return {configured:false,method:null,payloadMode:null,responseRuleConfigured:false};}}
export function batiRequest(config:ReturnType<typeof batiConfig>,recipient:string,body:string,context?:Record<string,string>){
 const url=new URL(config.url),headers:Record<string,string>={};if(config.headerName)headers[config.headerName]=config.headerValue;
 const fields:Record<string,string>={[config.recipientKey]:recipient,[config.bodyKey]:body};
 if(config.payloadMode==='legacy-student'){
  const keys=['메시지템플릿선택','학생 호칭','강의명','수강료','납부기한','등록상태','수강시작일','학년','학생연락처','보호자이름'];
  if(!context||keys.some(key=>typeof context[key]!=='string'))throw Error('MESSAGE_CONTEXT_REQUIRED');
  for(const key of keys)fields[key]=context[key];
 }
 if(config.method==='GET'){for(const [key,value]of Object.entries(fields))url.searchParams.set(key,value);return {url,options:{method:'GET',headers,redirect:'manual' as const,signal:AbortSignal.timeout(12000)}};}
 headers['Content-Type']='application/json';return {url,options:{method:'POST',headers,body:JSON.stringify(fields),redirect:'manual' as const,signal:AbortSignal.timeout(12000)}};
}
/** Never infer acceptance from arbitrary 2xx/HTML; use only the confirmed rule. */
export async function batiAccepted(response:Response,rule:ReturnType<typeof batiConfig>['response']){
 if(response.status!==rule.status||response.redirected)return false;
 if(rule.kind==='status')return true;
 const body=await response.text();if(body.length>65536)return false;
 if(rule.kind==='text')return body===rule.equals;
 let value:any;try{value=JSON.parse(body);}catch{return false;}
 for(const key of rule.path){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))return false;value=value[key];}
 return value===rule.equals;
}
