// Read this edit document inside the report-issuance transaction so an edit
// starting concurrently cannot issue a new link using the previous phone PIN.
export function assertContactEditAllowsIssuance(edit:any,sourceUpdatedAt?:string) {
    if(!edit?.contactChanged || edit.status==='discarded')return;
    const source=Date.parse(sourceUpdatedAt || ''),saved=Date.parse(edit.remoteEditedAt || '');
    if(edit.status!=='synced' || !Number.isFinite(source) || !Number.isFinite(saved) || source<saved)throw Error('STUDENT_PROFILE_CONTACT_PENDING');
}
