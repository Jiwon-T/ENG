/** Missing properties are empty, not valid query targets. Preserve boolean semantics. */
export function notionReadFilter(filter:any,properties:Record<string,any>):any {
 if(!filter)return true;
 if(filter.timestamp)return filter;
 for(const operator of ['and','or'])if(filter[operator]){
  const children=filter[operator].map((f:any)=>notionReadFilter(f,properties));
  if(operator==='and'&&children.includes(false))return false;
  if(operator==='or'&&children.includes(true))return true;
  const retained=children.filter((f:any)=>typeof f!=='boolean');
  if(!retained.length)return operator==='and';
  return retained.length===1?retained[0]:{[operator]:retained};
 }
 const schema=properties[filter.property];
 if(!schema)return Boolean(filter.rich_text?.is_empty||filter.select?.is_empty||filter.status?.is_empty);
 const type=schema.type;
 if(filter.select&&type==='status')return {property:filter.property,status:filter.select};
 if(filter.status&&type==='select')return {property:filter.property,select:filter.status};
 if(filter.rich_text&&type==='title')return {property:filter.property,title:filter.rich_text};
 if(!['relation','rich_text','select','status','date','title'].some(t=>filter[t]&&t===type))throw Error('NOTION_READ_SCHEMA_MISMATCH');
 return filter;
}
