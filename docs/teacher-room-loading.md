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

Current limit: source mirrors persist in Firestore and refresh modified pages on
reads. Cold relevant scopes still require their first import. Archives/deletions
are reconciled on the next read after ten minutes, or an explicit forced refresh.
This is request-driven synchronization, not a background worker. Authentication
and current permissions continue to run before source access. No deployment or
live signed-in browser timing measurement has been performed.

## 2026-10-05: initial loading improvements (1–3)

- Fast bootstrap reads an app display snapshot, never the Notion student directory.
  Snapshots expire after five minutes and are scoped by user, academy, role,
  current scopes and Notion profile/database identity. Without one, existing app
  mappings supply names. New unmapped students arrive with the fresh response.
  Successful fresh loads refresh the snapshot; snapshot failures are tolerated.
  Only names, IDs, enrollment labels and a contact boolean are stored, no phone
  numbers or PINs. Firestore client access to these snapshots is denied.
- Firebase user/profile reads run together and source discovery reuses the
  verified profile. Concurrent requests share in-flight Notion scope reads only;
  completed permissions are never cached. Every request still checks enabled
  access and current memberships. Unique memberships are read in batches of 100.
- Fast and fresh requests start together. Late fast data cannot overwrite fresh
  results; fast failures do not block fresh data. Fresh errors remain visible.
  Tab/version/account guards prevent obsolete responses from updating the view.

A linked teacher's initial request still checks live Notion permissions. The final section below adds source mirrors and bounded schedule reads (4–5).
Validation: all 189 tests, TypeScript check and production build passed. Tests
cover cold fast reads without Notion, permission batching/concurrent reuse and
changes, snapshot expiry/privacy/scoping, and fast/fresh response races.
No deployment or signed-in browser timing measurement performed.

## 2026-10-05: automatic previous lessons and today selections

- Selecting a student for a new single-student lesson automatically requests the
  latest applicable lesson's class round, study round, content and assignment.
  Rounds are copied as recorded, including decimal and zero values; they are not
  incremented. Scores, evaluations and old session times are not copied.
- The single and multiple editors share a date-selectable today list: active
  regular slots plus scheduled events, including makeups and all their students.
  Stopped slots/classes, cancelled/completed events and unauthorized subjects
  are excluded. Source and reflected schedule copies are deduplicated.
- A single-student choice fills the event date, subject and start/end; a group
  choice opens individual rows for every eligible student and fetches each
  student's own previous fields. Existing rows for the same student, subject,
  date and time are reused. Manual student additions use the same automatic fill.
- Previous fields come from the current teacher's app records ordered by lesson
  date and edit timestamp, excluding archived/future rows; without an app record,
  the configured Notion lesson source is queried. Local snapshots coalesce group
  requests and invalidate on saves. Notion reads include both study-round aliases.
- Manual continuation buttons were removed. Loads cannot overwrite a different
  student/date/subject, restored saved draft, explicitly absent session, or fields
  edited (including deliberately cleared fields) while a load is pending.
  New rows show loading and cannot be saved until their previous read completes.

Validation: all 197 tests passed; TypeScript check and production build passed.
The new tests cover schedule scope/status/deduplication, multiple recipients,
rounds and schedule times, edited fields, fallback parsing, and previous-record
access/cache invalidation. No deployment or live signed-in click test performed.

## 2026-10-05: wrong-answer input and loading improvements (4–5)

- Single and multiple lesson editors now accept wrong answers and question count
  for both tests. Either input order works; changes to totals keep the entered
  mistakes and recompute correct answers/score. Existing correct-count records
  display their equivalent wrong count. Server validation rejects mistakes above
  totals and incomplete score pairs. Existing Notion field mappings remain valid.
- Classes/curriculum use academy-scoped first imports with owner/assigned access
  rechecked on rows; timetable imports target visible classes only. Enrollment
  and school-grade reads scope students/teachers where appropriate. Shared legacy
  lesson rows remain supported. Raw source snapshots persist in a server-only
  Firestore mirror isolated by user/current permissions/query. Subsequent reads
  query last_edited_time with an overlap and merge changed pages. Moved-out rows
  are removed; archive/deletion is reconciled on the next request after ten
  minutes, or a forced refresh. Current authentication/assignment checks stay live.
- Mirror writes use a transaction lease and batches, with checkpoint advancement
  only after page writes succeed, so failed work can be replayed. Mirror pages are
  JSON strings to avoid Firestore nested-array restrictions. Force refresh uses
  a fresh scoped read even if another instance is already synchronizing.
- Schedule APIs load a specified day/week; calendar navigation fetches each new
  week. Notion date bounds use Korea time. Reflected app schedules query permitted
  internal student IDs and a bounded time range, followed by an exact Korea-date
  check for legacy offset timestamps. Local schedule drafts are similarly scoped
  by owner/academy and lesson date. No global studentSchedules scan remains in
  teacher workspace bootstrap or schedule-records.
- Three additional composite index definitions are included in
  firestore.indexes.json. Without them, queries fall back only to the selected
  period and recheck access on returned records; other failures remain errors.
- State-only class saves are detected on the server, excluding structural/book
  changes and failed/pending full syncs. Parent/changed-slot identity, relations
  and edit timestamps are checked before patches. Only status fields are patched;
  curriculum schemas/pages are untouched. The client fetches just that class
  after saving instead of refreshing the complete class/curriculum resource list.

Validation: all 206 tests passed, TypeScript check passed, production build passed.
Regression coverage includes wrong-first/legacy/zero scores, mirror deltas and
reconciliation/replay/isolation, schedule recipients/access/range/offsets/index
fallback, and an actual save-class API path performing status-only synchronization.
No deployment, live click verification or latency measurements performed.
