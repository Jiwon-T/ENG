/** Component-local cache, discarded when the teacher library unmounts. */
export class WordbookCache<T> {
 private entries=new Map<string,{items:T[];at:number}>();
 constructor(private limit=6,private ttl=60000){}
 get(id:string,now=Date.now()){const value=this.entries.get(id);if(!value)return undefined;if(now-value.at>=this.ttl){this.entries.delete(id);return undefined;}return value.items;}
 put(id:string,items:T[],now=Date.now(),requestStartedAt?:number){
  const previous=this.entries.get(id);
  if(requestStartedAt!==undefined&&previous&&previous.at>requestStartedAt)return;
  this.entries.delete(id);this.entries.set(id,{items,at:now});
  if(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);
 }
}
