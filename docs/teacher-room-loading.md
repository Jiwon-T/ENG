# Teacher room loading

- Bootstrap accepts `section=lesson|students|schedule|curriculum|settings|base`.
  The old full bootstrap remains compatible. The lesson section excludes all
  draft bodies, schedules, curriculum bodies, and staff/settings queries.
- Each section first shows a private in-memory browser snapshot (maximum five
  minutes old), or its quick app-data response, then revalidates. No student
  data is persisted in localStorage/sessionStorage. Account changes clear the
  cache, and generation checks prevent late requests refilling invalidated data.
- Saves fetch the changed record rather than the full workspace. Drafts refresh
  their current page, schedule reflection refreshes schedule resources, and
  class/curriculum changes refresh those two resources without the student
  directory, schedules, or settings. Form values remain independent of refresh.
- Draft pages query the owner's `updatedAt` summaries, cache that list briefly,
  then fetch only ten requested full documents. This uses the existing equality
  index and needs no new composite index. The initial summary query still reads
  every matching document; this is not a claim that the first Firestore billable
  read count is ten.
- Academic records are filtered on the server and returned twelve at a time.
  Academy lesson records are filtered on the server and returned ten at a time.
  Filter menus use metadata from the complete authorized snapshot, not just the
  current page. Search is debounced and superseded requests cannot replace newer
  filter results.
- Report sections request only their own collection. Lesson reports are returned
  five at a time for both parent and student audiences; existing audience DTO
  restrictions remain in place.
- Server list/source snapshots live for sixty seconds and are bounded to eighty
  entries per process. Every request still authenticates and checks current
  access; keys include UID, academy, role, scopes, and Notion profile identity.
  Private HTTP responses remain `no-store`. Mutations invalidate affected lists;
  remote writes invalidate all snapshots in that process. Explicit refresh
  bypasses the relevant cache.

Limit: source merging still reads the complete relevant Notion source on a cold
cache. Serverless instances do not share this process-local cache, so another
instance may need its own first read. Notion incremental/background synchronization
is a separate next step, not implemented here. No deployment or live account
browser verification is part of this change.
