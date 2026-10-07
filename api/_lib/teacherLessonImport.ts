/** Imported source is a new verified baseline, not a replay of an old write intent. */
export function lessonImportPublicationPatch(old:any,source:any){return {notionWrite:null,lastSubmittedRevision:source.stage==='published'?(old?.revision||0)+1:null};}
