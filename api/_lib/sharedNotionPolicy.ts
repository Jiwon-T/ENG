export function sharedRecordAccess(actor: any, academyId: string, assignedUids: string[], ownerUid: string) {
  if (!actor.admin && (!actor.academyId || actor.academyId !== academyId)) return false;
  return Boolean(actor.admin || actor.principal || assignedUids.includes(actor.uid) || ownerUid === actor.uid);
}
export function sharedRecordOwner(authors: string[], assigned: string[], profileMap: Map<string, string>) {
  const candidates = authors.length ? authors : assigned;
  const owners = [...new Set(candidates.map(id => profileMap.get(id)).filter(Boolean))];
  // Joint assignment without a unique author grants visibility, never ownership.
  return owners.length === 1 && candidates.length === 1 ? owners[0]! : '__unlinked_author__';
}
