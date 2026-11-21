# StuckRoom — Development Log

Append-only. Each entry separates **Developer** (what I decided, wrote, or verified myself) from **Agent** (what the AI coding assistant — Claude Code — explained, reviewed, researched, or wrote). Test results are copied exactly; "not run" means not run.

Submission deadline: 2026-11-21, 11:59 PM ET.

---

## 2026-11-17 — Scaffold, idea, and data model

**Goal:** Start the DeepSpace build exercise, pick a finishable scope, and design the data model before writing UI.

### Developer
- Scaffolded the app with `npm create deepspace@latest stuckroom` in `C:\Users\gon40\Documents\Dev` (outside OneDrive and outside my other project's folder).
- Defined the product: a Q&A "study room" site. Pages: Landing, Rooms list, a single room/thread, and My Questions (follow-up).
- Product decisions:
  - Replies are one level deep: reply to the question, or to a comment; no replies-to-replies.
  - Question status: `active`, `inactive`, `solved`.
    - `inactive` is automatic after **7 days** without owner activity. An owner reply sets it back to `active` and restarts the 7 days.
    - `solved` is set by the owner and stays solved unless the owner explicitly reopens it. Owners can never set `inactive` themselves; they can delete.
  - Signed-out visitors can see `active` and `solved` questions, but not `inactive` ones.
  - Differentiators beyond a basic forum: (A) live rooms (realtime replies + presence), (B) AI summary of a thread when it's marked solved.
- Data model:
  - `question`: `title`, `content`, `status`, `visibility` (`public` | `private`), `lastActiveDate`.
  - `reply`: `content`, `questionId` (always the question), `replyToId` (empty for a top-level reply).
- Wrote `src/schemas/question-schema.ts` and `src/schemas/reply-schema.ts`, registered both in `src/schemas.ts`.
- Chose "option A" for visibility (a separate `visibility` column) after learning `visibilityField` matches only one value.
- Accepted a known limitation: replies have no visibility of their own, so replies on an inactive question remain readable by anyone who queries them directly.

### Agent
- Pointed to the docs and to where each primitive lives in the scaffold; recommended scoping to 2–3 primitives with a reason each.
- Corrected its own earlier advice: the scaffold already ran `git init`; and the app's source (DeepSpace cloud repo vs GitHub) latches at the first release, so the first deploy should wait until that's decided.
- Reviewed the field list. Flagged: platform already provides `recordId`/`createdBy`/`createdAt`; one reference field doing two jobs (question vs parent reply); and that a client-computed "inactive" cannot be enforced by the server.
- Researched in docs and in `node_modules/deepspace` (v0.44.2):
  - `visibilityField` only takes effect when a role uses `read: 'published'`; the SDK even ships `lintSchemas` for this mistake.
  - `visibilityField` matches one exact value (`record[field] === value`; string form means `=== "public"`) — the reason for option A.
  - Signed-out visitors get the `viewer` role because the layout uses `<RecordProvider allowAnonymous>`; `'*'` is the fallback role.
  - Schemas with no `visibilityField` treat nothing as public, so `read: 'published'` there means owner-only.
  - Server actions run as the app (bypass RBAC), so value-level rules (who may set which status) belong there, with `writableFields` limiting direct edits.
- Wrote `src/schemas.test.ts` (schema linter + permission rules the developer decided). Did not edit the schema files.

### Verification
- `npm run type-check`: passes (run by agent).
- `npm run test:unit`: **3 failed | 14 passed (17)** (run by agent). Failures:
  1. `question` member `read: true` — signed-in users can read private (inactive) questions.
  2. `reply` uses `read: 'published'` with no `visibilityField` — signed-out visitors see zero replies.
  3. Same root cause as 2, caught by the general "published needs visibilityField" check.
- Note: an earlier version of the agent's test file did not check member `read`, so it passed with bug 1 present. Tests were tightened after reading the schema.
- Not yet run: dev server, deploy, any browser testing.

### Next
- Developer fixes the 3 failing permission rules.
- Next checkpoint: server actions for status changes (`markSolved`, `reopen`, owner-reply → active) that set `status`, `visibility`, and `lastActiveDate` together; restrict members to editing `title`/`content` via `writableFields`.
- Later: cron job for 7-day inactivity, realtime/presence, AI summary.
- Open: should admin read every question for moderation? Decide where the source repo lives before first deploy.

---

## 2026-11-17 — Permission fixes

### Developer
- Fixed `question` member `read` → `'published'` and `reply` `'*'`/`viewer` `read` → `true`.
- Admin keeps `read: true` on questions (can see private ones).

### Agent
- Re-ran checks; explained that `read` is the only read gate (whole row, server-enforced), so "visible in UI" vs "accessible" is a UI distinction, not a security one.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **17 passed (17)** (agent).

### Known limitation (documented for write-up)
- Replies are readable by anyone through the data API, including replies under a private (inactive) question. The UI never links to a hidden question, but a direct query of the `reply` collection returns them. Acceptable because `inactive` means stale, not secret.

---

## 2026-11-17 — First server action: `markSolved` (in progress)

**Goal:** Move status changes off direct client writes into a server action that checks ownership and sets `status` + `visibility` together.

### Developer
- Wrote `markSolved` in `src/actions/index.ts`: narrows `params.questionId` from `unknown` with `typeof`, `tools.get` with failure pass-through, ownership check `record.createdBy !== ctx.userId`, then `tools.update`.
- Decision: marking solved does **not** update `lastActiveDate`.

### Agent
- Explained `Record<string, ActionHandler<Env>>`, `ActionContext`, the `ActionResult` discriminated union, `unknown` narrowing, and the record envelope (`createdBy` lives outside `data`).
- Wrote `src/actions/index.test.ts`: calls the handler with a fake `ctx` (mocked `tools.get`/`update`) — invalid ids, lookup failure, non-owner, owner success, update failure.
- Review findings (not fixed by agent): handler not added to the `actions` object; `visibility: "private"` contradicts "solved is public"; update result ignored so failures report success.

### Verification
- `npm run type-check`: passes (agent). Type-check cannot catch the three findings above.
- `npm run test:unit`: **8 failed | 17 passed (25)** (agent). All 8 failures: `markSolved is not registered in the actions object`.

---

## 2026-11-17 — `markSolved` complete

### Developer
- Registered `markSolved` inline in the `actions` object, fixed `visibility: "public"`, returned the `tools.update` result, and reworded the error for users.

### Agent
- Re-ran checks. Read SDK source (`node_modules/deepspace/dist/worker.js`, record write path): `writableFields` is checked inside `if (!skipUserRbac)`, so it restricts direct client writes but not server-action `tools.*` writes. **Source inspection only; not yet reproduced against a running dev server.**

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **25 passed (25)** (agent).
- Not run: dev server, real HTTP call to `/api/actions/markSolved`.

### Next
- Add `writableFields: ["title", "content"]` to the `member` role on `question` so status/visibility/lastActiveDate can only change through actions.
- Then: `reopen` action (solved → active, owner only).

---

## 2026-11-18 — `writableFields`, `reopen`, and the inactivity clock

### Developer
- Committed schemas + `markSolved` (`812128d`).
- Added `writableFields: ["title", "content"]` to `question` member role.
- Wrote a `reopen` action (owner-only, sets `status: "active"`, `visibility: "public"`), registered as `reopon` (typo).
- Added `timestampTrigger: { field: "createdAt" }` to `lastActiveDate`, intending it to start the 7-day clock at creation.

### Agent
- Read SDK source (`worker.js` write path):
  - `updatedAt` is set to the same `now` as `createdAt` on insert, but is overwritten on **every** update (title edits, `markSolved`, the future cron job itself), so it means "row last changed", not "owner last active".
  - `timestampTrigger.field` is looked up in the record's own `data` columns. `createdAt` lives on the envelope, not in `data`, so this trigger never fires — the setting is a no-op.
- Added a `writableFields` schema test; refactored action tests so shared owner-only rules run for both `markSolved` and `reopen`.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **8 failed | 26 passed (34)** (agent). All 8 failures: `reopen is not registered` (action is named `reopon`).
- Not run: dev server or real HTTP calls.

### Open
- Remove the no-op trigger; cron will use `lastActiveDate ?? createdAt`.
- Does `reopen` count as owner activity (set `lastActiveDate`)? If not, reopening a question older than 7 days goes inactive again on the next cron run.

---

## 2026-11-18 — `reopen` complete

### Developer
- Renamed `reopon` → `reopen`; removed the no-op `timestampTrigger`.
- `reopen` now also sets `lastActiveDate: new Date().toISOString()` (reopening counts as owner activity, so the 7-day clock restarts).

### Agent
- Added a test that freezes time and checks `reopen` writes `lastActiveDate` as the current ISO timestamp.
- Clarified: nothing updates `lastActiveDate` automatically. The future cron job only *reads* `lastActiveDate ?? createdAt`; only action code writes it.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **35 passed (35)** (agent).
- Not run: dev server or real HTTP calls.

### Next
- Owner-reply flow: creating a reply as the question owner should set the question back to active and restart the clock (third copy of the owner/get logic → good time to extract a helper).
- Then the 7-day cron job.

---

## 2026-11-18 — Design: owner replies go through a `postReply` action

### Developer
- Chose option A: a single `postReply` server action creates the reply and, when the caller owns the question, restarts the question's clock. Reason: with two browser calls (option B) an interrupted browser leaves the question un-updated.
- Clarified: the cron's `now` is computed fresh each run; only `lastActiveDate` must be written by code.
- `api-status.tsx` diff is formatter-only (quotes/semicolons on save); agent confirmed no logic change.

### Agent
- Confirmed from `src/server/action-routes.ts` and SDK source that action `tools.*` calls carry the caller's `userId`, so `tools.create` records the **caller** as `createdBy` (reply ownership works). The same file warns that action tools read/write any row with RBAC off.
- Flagged for the spec: `postReply` must refuse private questions for non-owners itself, because `tools.get` bypasses the `'published'` read rule.
- Not yet verified: whether records written by actions broadcast to realtime subscribers (source shows `broadcastChange` in the shared write path; to confirm in the dev server).

### Verification
- No code changes; tests not re-run.

---

## 2026-11-18 — `postReply` (in progress)

### Developer
- Wrote `postReply` in flat early-return style: validates `questionId`/`content` (trimmed) and optional `replyToId`; loads the question; refuses non-owners on private questions; validates the parent reply (same question, top-level); creates the reply from params once; updates the question for owner replies unless solved; returns the create result.
- Decisions: owner reply does **not** reopen a solved question; a sent `replyToId: null` is rejected (browser must omit the key).

### Agent
- Explained `undefined` vs `null` for optional params and how `tools.get` reports not-found.
- Wrote 18 `postReply` tests with a fake per-collection record store.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **4 failed | 52 passed (56)** (agent).
  - 3 failures: owner check inverted (`createdBy !== ctx.userId` at the clock update), so other users' replies restart the owner's clock and owner replies don't.
  - 1 failure: parent top-level check is `replyToId !== ""`; a parent whose empty `replyToId` is stored as absent would be wrongly refused. Platform storage of empty optional text is unverified.
- Open: if the question update fails after the reply was created, the action returns failure though the reply exists (retry → duplicate).

---

## 2026-11-18 — `postReply` complete; source-control decision

### Developer
- Fixed the inverted owner check (`createdBy === ctx.userId`) and made the parent top-level check a truthiness check on `replyToId`.
- Decided: if the reply is created but the clock update fails, return the create result (success) and `console.error` the failure. Reason: reporting failure would make users resend and duplicate the reply; a missed clock refresh only risks an early `inactive`.
- Accepted the timeline: Wed backend + dev server, Thu pages, Fri cron/presence/AI/first deploy, Sat fixes + write-up.
- Source control: **DeepSpace cloud repo** (latches permanently at first push/deploy).

### Agent
- Added a test for the clock-update-failure path and a schema test requiring `reply` member `create: false` (replies only via `postReply`).
- Checked docs: a DeepSpace-source app may keep a GitHub "review copy" (`git remote add origin ...; git push -u origin main`; never `--mirror`). The docs don't describe how outside reviewers access the cloud repo.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: 57/57 before the new schema test; after adding it, see next entry / expected 1 failure until `reply` member `create` is set to `false`.

---

## 2026-11-18 — Closing the reply edit gap; first local run

### Developer
- Set `reply` member `create: false` (committed in `46ff084` with `reopen`/`postReply`).
- Added `writableFields: ["content"]` to `reply` member after the agent pointed out that `update: "own"` let an owner re-point `replyToId` and break the one-level rule.
- Decision: replies stay when the comment they answer is deleted (UI will show them as replies to a deleted comment). No cascade.
- Ran the app locally (`npm run dev`); the starter page loads with its placeholder content.
- Asked whether all direct writes should become actions. Conclusion: no — only where the platform's permissions cannot express the rule (reply creation, status changes). Owner-only edits/deletes stay on `'own'` + `writableFields`.

### Agent
- Explained why `create: false` still allows `postReply` (actions skip the RBAC create check) and "one repo, two remotes" for the DeepSpace + GitHub review copy.
- Added a schema test for reply `writableFields`.

### Verification
- `npm run type-check`: passes (agent).
- `npm run test:unit`: **59 passed (59)** (agent).
- Local dev server: run by developer; agent did not observe it.

### Next (Thu)
- Pages: rooms list, single room with replies, My Questions.

---

## 2026-11-18 — Rooms list page (first UI, in review)

### Developer
- Wrote `src/pages/(app)/rooms.tsx` using `useQuery<Question>("question", { where: { visibility: "public" }, orderBy: "createdAt", orderDir: "desc" })` with loading/error states; added a `Question` type in `src/pages/types.ts`; temporarily rendered `<Rooms />` from `home.tsx`.
- Decisions: Rooms shows only public questions; My Questions shows only the caller's own questions (`where: { createdBy: <my id> }`); clicking a question opens its thread.

### Agent
- Explained `useQuery` (live, permission-filtered subscription returning envelopes) vs `useMutations` (the direct-write door) and which writes use actions instead.
- Confirmed in SDK source (`worker.js` table query): client `where` supports schema columns plus `recordId` and `createdBy`; **unknown `where` keys are silently ignored** (a typo returns unfiltered results).
- Review findings: accidental auto-import from a react-router internal file; page uses a named export (generouted routes need `export default`, so `/rooms` renders nothing); missing `key` on list items; `lastActiveDate` typed as `Date` but stored/returned as an ISO string and may be absent; types file lives inside `src/pages/`.

### Verification
- `npm run type-check`: passes (agent). Lint: no output for `rooms.tsx`.
- Browser: not observed by agent.

---

## 2026-11-18 — Rooms list page fixes

### Developer
- Removed the accidental react-router internal import; switched to `export default`; restored `home.tsx`; moved the type to `src/types.ts`; added a `key`; changed `lastActiveDate` to `string | null`.

### Agent
- Review: `key={record.createdBy}` is not unique (one user, many questions); missing values come back as `undefined`, so an optional property (`?:`) fits `lastActiveDate` better than `| null` alone.

### Verification
- `npm run type-check`: passes; eslint on `rooms.tsx`/`types.ts`: no output (agent). Router lists `/rooms`.
- Browser rendering of `/rooms`: not observed by agent.

---

## 2026-11-18 — Thread route and links

### Developer
- Moved the list to `src/pages/(app)/rooms/index.tsx`, added `rooms/[id].tsx` (reads `id` with typed `useParams("/rooms/:id")`), and wrapped each item in the typed `Link` with `key={record.recordId}`. `lastActiveDate?: string | null`.
- Verified in the browser: `/rooms` renders "Found 0 questions" (no data yet).

### Agent
- Reviewed: all previous findings resolved. Router now lists `/rooms/:id` with `{ id: string }` params.

### Verification
- `npm run type-check`: passes (agent).
- Link click-through: not yet testable (no questions exist).

### Next
- New-question form (landing page) with `useMutations`, which also unblocks manual testing of the list and thread.

---

## 2026-11-19 — New-question form

### Developer
- Wrote `src/components/NewQuestionForm.tsx`: controlled inputs, `useMutations<NewQuestion>` with `type NewQuestion = Pick<Question, "title" | "content">`, `createConfirmed` with trimmed values, try/catch error message. Rendered on `home.tsx`.
- Schema: `title` and `content` now `required: true`, `maxLength` 255 / 1000 (server-side validation via platform).
- Reported the form "kinda works".

### Agent
- Added schema tests for required/maxLength.
- Review findings (not changed by agent): no redirect to the new thread (returned id unused); form shown to signed-out visitors; no double-submit guard (two clicks → two questions); `ready` not used; content is a single-line `<input>` with no `maxLength` mirroring the schema; `catch (error)` shadows the `error` state.
- Checked `useAuthProfileReady({ requireUser: true })`: waits for the signed-in user's profile; it does not redirect signed-out visitors.

### Verification
- `npm run type-check`: passes; eslint on form/home: no output (agent).
- `npm run test:unit`: **61 passed (61)** (agent).
- Browser: developer reports partial success; specifics pending.

---

## 2026-11-19 — New-question form fixes

### Developer
- Form now navigates to `/rooms/:id` with the id returned by `createConfirmed`; added `submitting` state (set before await, cleared in `finally`) and disables Submit while submitting; renamed catch variable; `import type`; `Textarea` with `maxLength` 255/1000 mirroring the schema.
- Browser-verified by developer: posting lands on the thread page; signed-out visitors see questions on `/rooms` and cannot create them.

### Agent
- Review: `home.tsx` still renders the form for signed-out visitors (server rejects their submit, but the UI should show a sign-in prompt instead); title uses a multi-line `Textarea` where `Input` fits; `ready` not used.

### Verification
- `npm run type-check`: passes; eslint: no output (agent).
- Browser behavior: reported by developer, not observed by agent.

---

## 2026-11-19 — `groupReplies` (in progress)

### Developer
- Started `src/lib/threads.ts` `groupReplies` (two-pass Map approach) and added `Reply` and `Group` types to `src/types.ts`.

### Agent
- Explained multiple `useQuery` calls with destructuring renames, and the two-pass grouping algorithm with a worked example.
- Found that `useQuery` returns `RecordData<T>[]` (exported type from `deepspace`: `recordId`, `data`, `createdBy`, `createdAt`, `updatedAt`).
- Wrote `src/lib/threads.test.ts` (8 tests) as the target spec: input `RecordData<Reply>[]`, output groups `{ reply, children }`; orphans become top-level; child-before-parent still nests; nothing lost or duplicated.
- Review findings: missing `}` (TS1005); top-level groups keyed by `replyToId` (`""` for all, so they overwrite each other) instead of the reply's own `recordId`, which `Reply` (data only) doesn't contain; `Group.reply` stores a string instead of the reply; `children: object`; orphans dropped; no return value.

### Verification
- `npm run type-check`: fails, `threads.ts(24,1) TS1005 '}' expected` (agent).
- `npx vitest run src/lib/threads.test.ts`: transform fails on the same syntax error; 0 tests ran (agent).

---

## 2026-11-19 — `groupReplies` complete

### Developer
- Rewrote `groupReplies(replies: RecordData<Reply>[]): Group[]`: pass 1 keys top-level replies by `recordId`; pass 2 attaches children or promotes orphans (deleted parent) to top-level; returns `Array.from(map.values())`. `Group` now holds the full reply envelope and typed children, defined in `threads.ts`.

### Agent
- Review leftovers: old `Group` type in `src/types.ts` is unused and has the wrong shape; `Group` in `threads.ts` isn't exported; `Reply.replyToId` still non-optional.

### Verification
- `npm run test:unit`: **69 passed (69)**, including 8 `groupReplies` tests (agent).
- `npm run type-check`: passes (agent).

---

## 2026-11-19 — Thread page (read-only)

### Developer
- Wired `rooms/[id].tsx`: two `useQuery` calls (question by `recordId`, replies by `questionId` oldest-first) with renamed destructuring; loading/error/not-found states; question details with author via `useUserLookup().getName` and formatted time; `groupReplies` rendering with indented children and a "Replying to a deleted comment" note for orphans.
- Tidy-ups done: removed old `Group` from `types.ts`, exported `Group` from `threads.ts`, `replyToId?: string`. Committed `groupReplies` (`392b6b0`).

### Agent
- Review (minor): repeated `questions[0]` (assign once); redundant `questionStatus === "ready"` in the not-found check; reply times shown as raw ISO; `getName` can return null (needs a fallback); typo "momment".
- Checked SDK client exports: only `getAuthToken()` exists for calling actions; there is no client action helper, so the reply form needs a small `fetch` wrapper.

### Verification
- `npm run type-check`: passes; eslint on `[id].tsx`: no output (agent).
- Browser: not observed by agent.

---

## 2026-11-19 — `callAction` browser helper (in review)

### Developer
- Wrote `callAction(name, params): Promise<ActionResult>`: `getAuthToken()` (null → "Sign in first", no request), POST JSON with Bearer token, `!res.ok` → failure with status, try/catch for network/parse errors. Placed it at the bottom of `src/actions/index.ts`.
- Added `src/lib/formatDate.ts` (`toLocaleString("en-US", …)`).

### Agent
- Review: `src/actions/index.ts` is server code (imported by the worker). Putting a browser helper there pulls the client SDK (`getAuthToken` from `deepspace`) into the worker module, and any page importing `callAction` would bundle all server action handlers into the browser. Asked to move it to `src/lib/actions.ts`.
- `return data as ActionResult` is an assertion, not validation; JSON without a boolean `success` would reach the UI typed as a result.
- Wrote `src/lib/actions.test.ts` (10 tests: signed out, request shape, success/failure pass-through, HTTP 401/404/500, network error, non-JSON, non-ActionResult JSON) with `vi.mock("deepspace")` and a stubbed `fetch`.

### Verification
- `npm run type-check`: passes (agent).
- `npx vitest run src/lib/actions.test.ts`: fails to load, `Cannot find module '/src/lib/actions'` (helper not moved yet) (agent).

---

## 2026-11-19 — `callAction` complete

### Developer
- Moved `callAction` to `src/lib/actions.ts` (browser side); removed it and the `getAuthToken` import from the server actions file.
- Questioned the agent's validation advice using the SDK docs' `as ActionResult` example; after discussing trust boundaries (own server response vs untrusted `params`), chose to add the inline runtime check (`unknown` → object, non-null, boolean `success`).

### Agent
- Explained the inline check and the type-guard alternative (`x is ActionResult`). Confirmed `!res.ok` already covers the 401/404 bodies in `action-routes.ts`.

### Verification
- `npx vitest run src/lib/actions.test.ts`: **10 passed (10)** (agent). Before the check: 9/10 (only the non-ActionResult JSON case failed), matching the agent's prediction.

### Next
- Reply form on the thread page using `callAction("postReply", …)`.

---

## 2026-11-19 — Reply form (in review)

### Developer
- Wrote `src/components/ReplyForm.tsx` (props `questionId`, optional `replyToId`; `callAction("postReply", …)`; `submitting` state; `maxLength` 1000) and wired it into the thread page with a `replyingTo` state and per-reply "Reply" buttons; signed-out users see "Sign in to reply."
- Reply `content` now `required: true`, `maxLength: 1000` in the schema. Used `formatDate` and an "Unknown user" fallback on the page.

### Agent
- Added a schema test for reply content limits.
- Review findings (not changed by agent):
  - ReplyForm: `setSubmitting(false)` is never called, so the button stays disabled after the first submit (success or failure); on failure `return result.error` discards the message instead of `setError`; content sent untrimmed.
  - Page: the not-found check now runs before the loading check, so every thread shows "Question not found" while loading; `formatDate(new Date(...).toLocaleString())` re-parses a locale string; Reply button shown on orphans (server refuses) and to signed-out users; the reply target switches the bottom form silently and is never cleared after posting.
- UI component tests not added: no DOM test environment (jsdom/testing-library) is installed; behavior is checked manually in the browser.

### Verification
- `npm run test:unit`: **80 passed (80)**; `npm run type-check`: passes; eslint: no output (agent).
- Browser: not observed by agent.

---

## 2026-11-19 — Reply form fixes

### Developer
- ReplyForm: `setSubmitting(false)` after the await, `setError(result.error)` on failure, sends trimmed content, new optional `onSuccess` prop.
- Page: loading → error → not-found order fixed; `formatDate(question.createdAt)`; Reply button only when signed in; nested ReplyForm renders under the chosen comment and closes via `onSuccess`; bottom form is always top-level.
- Browser-checked by developer: signed-out window shows no Reply buttons or forms; "things look correct."

### Agent
- Review: on failure the form still clears the text and calls `onSuccess` (missing `return`), so a failed reply loses the user's text and closes the nested form; Reply button still shown on orphans; no Cancel; two open forms share `id="content"`.

### Verification
- `npm run test:unit`: **80 passed (80)**; type-check and eslint clean (agent).
- Two-window realtime check: not yet reported.

---

## 2026-11-19 — Reply flow complete; realtime verified

### Developer
- ReplyForm: early `return` after `setError` (failed replies keep the text and the form stays open); `useId()` for unique label/field ids.
- Page: Reply button only for signed-in users on non-orphan top-level replies; Cancel button for the nested form.
- **Browser-verified by developer:** two-window test, a reply posted in one window appears in the other **without refreshing**; signed-out window shows no reply controls.

### Agent
- Re-reviewed; no remaining findings for this checkpoint.

### Verification
- `npm run test:unit`: **80 passed (80)**; type-check and eslint clean (agent).
- Realtime sync: verified by developer in the browser (not observed by agent).

### Next
- My Questions page under `(protected)` (AuthGate already requires sign-in): `where: { createdBy: <my id> }`, Mark solved / Reopen via `callAction`.

---

## 2026-11-19 — End of day 3; plan change

### Developer
- Stopped for the day before starting the My Questions page.
- Plan change: Friday may not be realistic (busy). Intends to complete the remaining work on Saturday **using AI to implement it** (explicit choice). Confirmed in scope: 7-day cron, presence, AI solved-summary. Deploy timing and GitHub review copy undecided.

### Agent
- Wrote a handoff document outside the repo (`C:\Users\gon40\Documents\Dev\STUCKROOM_CONTEXT.md`, auto-loaded via `Dev\CLAUDE.md`): working agreement, submission requirements, product rules, architecture, decisions, verified SDK facts, status, schedule, open questions.
- Recommended Saturday priority: deploy current app first → My Questions → reserve time for the note → cron → presence → AI summary; redeploy after each working feature.

### Verification
- No code changes. Last results: `npm run test:unit` 80/80, type-check clean (agent, earlier today). Latest commit `0e3eea8`.

---

## 2026-11-19 (evening) — First deploy

### Developer
- Committed `15f5043` "End of day 3" and ran `npx deepspace deploy`. Reports the live app "doesn't seem like anything wrong".

### Agent
- Confirmed with `npx deepspace status --json` / `app source --json` (read-only): live at **https://stuckroom.app.space**, serving commit `15f5043` (clean, `sourceDirty: false`), release seq 2, source provider **deepspace** (now permanent), trunk in sync with the `space` remote.

### Verification
- Deploy recorded and serving (agent, via CLI status).
- Live-site behavior: developer's general check only; specific flows on the live URL not yet reported.

---

## 2026-11-20 — My Questions page: first attempt reviewed

### Developer
- Wrote `src/pages/(app)/(protected)/my-questions.tsx`: parent waits for `useUser()`'s `user`, passes `userId: string` to a child `MyQuestionList` that queries `where: { createdBy: userId }`; Mark Solved (active) / Reopen (solved or inactive) via `callAction`.
- Asked whether `user.id` matches `record.createdBy`. Agent traced the SDK source: both come from the auth token's `sub` claim (client `index.js:1541`, worker `worker.js:6385`), and `where.createdBy` filters `_created_by` (`worker.js:2285`). Source reading only; not yet browser-verified.

### Agent
- Review findings: collection name `"questions"` should be `"question"`; action buttons are nested inside the `<Link>` (click likely navigates; invalid HTML); id passed through `recordId` state between click and submit (fragile; pass id as an argument); action errors returned from the handler instead of rendered; minor: debug `userId` output, unused `isLoading`, `import type`.

### Verification
- `npm run type-check` clean; `npx eslint` on the page clean; `npm run test:unit` **80 passed (80)** (agent, run from PowerShell — a run from Git Bash's `/c/...` path failed with "Vitest failed to find the current suite"; environment issue, not app code).
- Browser: not yet tested.

---

## 2026-11-20 — My Questions page: review issues fixed

### Developer
- Fixed all review findings: collection `"question"`, title-only `Link`, id passed as a handler argument (no form/state), errors stored in state and rendered once above the list, `key` on the row `div`, `type="button"`, `isLoading` handled, `import type`.
- Browser (developer-reported): clicking Mark Solved / Reopen changes the status; visibility did not change.

### Agent
- Explained that unchanged visibility is expected: both actions write `visibility: "public"`, new questions default to public, and only the (not yet built) 7-day cron makes a question private. The private→public reopen path is covered by `src/actions/index.test.ts` (inactive + private fixture). No remaining code findings.

### Verification
- `npm run type-check` clean; `npx eslint` on the page clean; `npm run test:unit` **80 passed (80)** (agent, PowerShell).
- Two-window live update between `/my-questions` and `/rooms`: not yet reported.

---

## 2026-11-20 — My Questions complete; cron assigned

### Developer
- Confirmed solved questions should stay public. **Browser-verified:** two-window test — Mark Solved / Reopen on `/my-questions` updates `/rooms` live without refresh.
- Committed `8e4afd8` "Add My Questions page with mark solved / reopen".

### Agent
- Checked `npx deepspace status --json` (read-only): live still serves `15f5043`; `8e4afd8` is local-ahead, not yet deployed.
- Read the SDK cron source before assigning the next task: `ctx.records.query` returns `unknown[]` record envelopes, accepts only `where` + `limit` (no offset/orderBy, default 50, ~30KB page cap), runs as an app action (RBAC-off), and throws on tool failure.
- Assigned checkpoint 1 of the 7-day cron: pure helper `src/lib/inactivity.ts`.

### Verification
- Last agent run (earlier today): `npm run test:unit` 80/80, type-check and eslint clean. No code changes since.

---

## 2026-11-20 — Deploy 3; inactivity helper

### Developer
- Committed `dcbf52d` and deployed: live release 3 serves `dcbf52d` (agent confirmed via `npx deepspace status --json`).
- Wrote `src/lib/inactivity.ts`: `INACTIVE_AFTER_MS` (7 days) and `isInactive(lastActive: Date, now: Date)`; chose `>=` (exactly 7 days counts as inactive).
- Design call: take `Date` (not strings) and validate untrusted rows in `cron.ts` before calling — "parse at the boundary".

### Agent
- Review: first attempt subtracted `lastActive - now` (never true for past dates); fixed by developer. Noted that a `Date` can still be invalid (`getTime()` → NaN), so the boundary must check `Number.isNaN`; NaN comparisons make `isInactive` return false (safe default).
- Wrote `src/lib/inactivity.test.ts` (8 tests: 7-day constant, well past, 1 day, exactly 7 days, 1 ms under, equal, future date, invalid date).
- Checked SDK: `useCronMonitor().trigger(taskName)` can run a task manually (no cron UI exists yet).
- Assigned checkpoint 2: `mark-inactive` task in `src/cron.ts`.

### Verification
- `npm run type-check` clean; eslint clean; `npm run test:unit` **88 passed (88)** (agent, PowerShell).

---

## 2026-11-20 — Cron task: first attempt reviewed

### Developer
- Wrote `src/cron.ts`: `mark-inactive` task (hourly); `toCandidate(row: unknown)` boundary validation (`in` + `typeof` narrowing, array check, `lastActiveDate ?? createdAt`, `Number.isNaN`); queries `status: "active"` (limit 50), computes `now` once, updates stale questions to inactive + private.
- Decision: if one update fails, the remaining questions should still be checked.

### Agent
- Verified from SDK source: unset columns are omitted from `data` (`rowToData` skips null/undefined), so the `createdAt` fallback works; `CronRoom` catches a thrown task error and records the run as failed in cron history.
- Wrote `src/cron.test.ts` (12 tests, `deepspace/worker` mocked, fake timers): task registration, unknown names ignored, room id/owner, active-only query, createdAt vs lastActiveDate, mixed batch, 11 kinds of malformed rows skipped, per-update failure isolation, query failure rejects.
- Review: no `try/catch` around the update, so the first thrown update aborts the loop (contradicts the decision above). Minor: stale scaffold comment; `new Date(Date.now())` → `new Date()`.

### Verification
- `npm run type-check` clean; eslint clean on `src/cron.ts` and `src/cron.test.ts`.
- `npm run test:unit`: **99 passed, 1 failed (100)** — failing: "keeps processing the remaining questions when one update throws" (expected `['q1','q2','q3']`, received `['q1','q2']`). Expected failure pointing at the missing try/catch.

---

## 2026-11-20 — Cron: failure isolation fixed; option B pending

### Developer
- Added `try/catch` + `console.error` in the loop; one failed update no longer stops the rest.
- Decision **B**: keep processing, then fail the run if any update failed — "the app should alert that something went wrong instead of silently logging it" (cron history records thrown runs as failed).

### Agent
- Added 2 tests to `src/cron.test.ts` encoding option B (rejects after all 3 updates attempted when one fails; resolves when all succeed).
- Review: the code still implements A (no failure count / throw after the loop); `try` wraps validation and the `continue`s, not just the update (hence the `result?.recordId ?? "unknown"` fallback); scaffold comment and `new Date(Date.now())` nits remain.

### Verification
- `npm run type-check` clean; eslint clean.
- `npm run test:unit`: **101 passed, 1 failed (102)** — failing: "rejects after processing all questions when any update failed" ("promise resolved undefined instead of rejecting"). Expected; points at the missing option B code.

---

## 2026-11-20 — 7-day inactivity cron complete (unit-level)

### Developer
- Implemented option B: `failed` counter in the `catch`; throws `Failed to update N inactive question(s)` after the loop. Moved the null/`isInactive` checks above the `try` so only the update is wrapped. Removed the scaffold comment; `new Date()`.

### Agent
- Re-reviewed: no remaining findings (nit: `result.recordId ?? "unknown"` fallback is now unreachable).
- Found `npx deepspace logs` for live verification: `CronRoom` logs `[cron] mark-inactive ok <ms>` / `failed` per run.

### Verification
- `npm run type-check` clean; eslint clean; `npm run test:unit` **102 passed (102)** (agent, PowerShell).
- Live cron run: not yet observed (needs deploy, then a site visit to arm the schedule, then up to an hour). No real question is 7+ days old yet (first deploy 2026-11-19), so a live inactive transition can't be observed before the deadline; the transition is covered by unit tests with a mocked context only.

---

## 2026-11-20 — Presence on threads

### Developer
- Wrote `src/components/ThreadPresence.tsx` (`usePresenceRoom(\`question:${questionId}\`)`; nothing while disconnected, "Just you here", or "Also here: <names>") and rendered it on `rooms/[id].tsx`.
- First browser test showed the two windows seeing each other; observed that **signed-out visitors appear as "Anonymous"** peers, and that the signed-out window shows the question author as "Unknown user".
- Fixed after review: destructured props, single joined line of names, `return null`. Cleaned the unreachable `?? "unknown"` in `src/cron.ts`.

### Agent
- Review: the component took `questionId: string` as its whole argument (type-check error TS2322). At runtime it received the props object, so the scope was `"question:[object Object]"` — **every thread shared one presence room**; the first browser test passed by accident. Explained the `question:` prefix as namespacing (all presence scopes share one app-wide namespace). Also flagged one-`div`-per-peer without keys.
- Noted for polish: `useUserLookup` names appear unavailable to signed-out visitors ("Unknown user"); not investigated.

### Verification
- `npm run type-check` clean; eslint clean; `npm run test:unit` **102 passed (102)** (agent). No automated tests for presence (UI).
- Browser re-test after the fix (different threads must not see each other; same thread must): **pending developer report**.

### Verification (update)
- **Browser-verified by developer** after the fix: windows on different threads do not see each other; windows on the same thread do.

---

## 2026-11-20 — AI summary: design decisions

### Developer
- **(b) separate `summarize` action**, called by the page after `markSolved` succeeds — one action, one job.
- **Reopen keeps the summary** (a later solve regenerates it).
- Billing: willing to pay to confirm the feature works, not to keep paying afterwards. Has OpenAI API credit, no Anthropic key; asked whether to use OpenAI temporarily.

### Agent
- Verified from SDK source: a server action can call a model via `createDeepSpaceAI(ctx.env, provider)` + `generateText` from `ai@7` (installed). Providers: `anthropic | openai | cerebras`, routed through the DeepSpace proxy and billed to **DeepSpace credits** (owner via `APP_OWNER_JWT` by default, or the caller via `{ authToken: ctx.callerJwt }`) — no personal API key involved. SDK default summarization model: `claude-haiku-5-5`.
- Pointed out the (b) risk (tab closes after `markSolved` → solved with no summary) and proposed an owner-only "Generate summary" retry button when solved and no summary exists.
- Recommended against a personal OpenAI key (a secret to manage, bypasses the platform AI primitive, and the deployed app keeps spending it). Open: developer to check DeepSpace credit balance on the dashboard.

### Verification
- No code changes. No model calls made.

---

## 2026-11-21 — AI summary checkpoint 1: `summary` column + display

### Developer
- Added optional `summary` column (`storage: "text"`, `interpretation: "plain"`) to `question`; left out of `writableFields`. Added `summary?: string` to `Question`. Thread page shows "Summary (from when this was solved): …" when present.
- Working tree also contains a large Tailwind styling pass on `rooms/[id].tsx`, `rooms/index.tsx`, and `my-questions.tsx` (+389/−109 lines total). **Authorship to confirm with developer** for the submission note (agent did not write it).

### Agent
- Review: checkpoint correct; existing test already pins member `writableFields` to `['title','content']`, so `summary` stays server-only. Nit: `: ""` branch → `&&`/`null`; summary block unstyled amid the new styling.
- Added 1 test to `src/schemas.test.ts` (summary column exists, text, optional).

### Verification
- `npm run type-check` clean; eslint clean on the 3 changed files; `npm run test:unit` **103 passed (103)** (agent).
- Styling pass: not reviewed in the browser by agent; lint/type-check only.

---

## 2026-11-21 — Styling authorship; summary prompt spec

### Developer
- **Correction to the previous entry:** the Tailwind styling pass on `rooms/[id].tsx`, `rooms/index.tsx`, and `my-questions.tsx` was **not written by the developer** (no time); it came from another AI tool, not this assistant. Record it as AI-generated styling in the submission note.
- Decision: when a thread exceeds the prompt cap, **drop the oldest replies** (the solution is usually near the end); always keep the question. Started `src/lib/summaryPrompt.ts` (`MAX_THREAD_CHARS = 6000`, signature only).

### Agent
- Wrote `src/lib/summaryPrompt.test.ts` (10 tests) encoding the spec: question title/content inside `<thread>…</thread>`; instructions before the thread mentioning instructions; replies oldest-first; no-replies case; over the cap → newest contiguous block kept, oldest dropped, question + kept reply text ≤ `MAX_THREAD_CHARS`, as many as fit.

### Verification
- `npm run type-check`: **1 error** (TS2355, `buildSummaryPrompt` has no return yet — expected, stub).
- `npm run test:unit`: **105 passed, 8 failed (113)** — the 8 failures are the new spec tests against the stub (expected).

---

## 2026-11-21 — Summary prompt builder implemented

### Developer
- Implemented `buildSummaryPrompt`: budget = cap − title − content; walks replies newest→oldest, `unshift`s while they fit, stops at the first that doesn't; returns instructions + `<thread>` block.

### Agent
- Review: correct against the spec. Findings: a reply containing the literal text `</thread>` can close the delimiter early (prompt-injection escape; low impact since output is display-only and the model has no tools — recommended stripping the delimiter from user text); template-literal indentation is sent to the model; replies not labeled/separated; instruction omits "what the problem was and what solved it"; `let kept` → `const`.
- Checked SDK for checkpoint 3: `ctx.tools.query` supports `where`, `orderBy`, `orderDir`, `limit` (default 50) and returns `{ success, data: { records, count } }`.

### Verification
- `npm run type-check` clean; eslint clean; `npm run test:unit` **113 passed (113)** (agent).

---

## 2026-11-21 — `summarize` action + first live AI summary

### Developer
- Prompt builder fixes: `clean()` strips `<thread>`/`</thread>` from user text; prompt built with `[...].join("\n")`; replies labeled `Reply N:`; `const kept`.
- Wrote the `summarize` server action: validate `questionId` → owner check → solved-only → query replies `desc` limit 50 then `.reverse()` (explained: with >50 replies, `asc` would return the oldest 50 and drop the newest) → `buildSummaryPrompt` → `createDeepSpaceAI(ctx.env, "anthropic")("claude-haiku-5-5")` + `generateText` (`maxOutputTokens: 300`) in try/catch → reject empty output → `tools.update({ summary })`.
- Added a Summarize button on My Questions (`handleSummarize` via `callAction`).
- **Browser-verified (live model call, developer's DeepSpace credits):** summarizing a solved question with placeholder text and no replies produced a summary saying the thread contains no real question or resolution (did not invent a solution). Credit cost per call: not measured yet.

### Agent
- Wrote `src/actions/summarize.test.ts` (20 tests; `ai` and `createDeepSpaceAI` mocked — no credits): validation, owner-only, solved-only, failed lookups pass through, desc/limit-50 query, oldest-first prompt, proxy + model + output cap, trimmed save, writes only `summary`, no-replies case, model throw → friendly error without leaking internals, empty output rejected.
- Added 1 test to `src/lib/summaryPrompt.test.ts` (delimiters stripped from user text).
- Review findings: `markSolved` success does not call `summarize` yet (decision b); Summarize button shows for every status (server rejects non-solved); `title`/`content` read with `as string` (a type assertion, not a runtime check); summary block still unstyled.

### Verification
- `npm run type-check` clean; eslint clean; `npm run test:unit` **134 passed (134)** (agent).

---

## 2026-11-21 — AI summary wiring (agent-implemented at developer's request)

### Developer
- Asked the agent to implement the remaining small review items to save time before the deadline. (Had already limited the Summarize button to `status === "solved"`.)

### Agent (wrote this code)
- `my-questions.tsx`: `handleMarkSolved` now calls `summarize` after `markSolved` succeeds (decision b); a summary failure shows "Marked as solved, but the summary failed: …" and leaves the question solved. Button label is "Generate summary" / "Regenerate summary" depending on whether a summary exists (the retry path), with a `Sparkles` icon.
- `rooms/[id].tsx`: styled the summary block as a labeled section ("AI summary (from when this was solved)").
- `src/actions/index.ts`: `ctx.tools.get<Question>(...)` in `summarize`, removing the `as string` casts on title/content.

### Verification
- `npm run type-check` clean; eslint clean on the 3 files; `npm run test:unit` **134 passed (134)** (agent).
- Browser check of the new wiring (mark solved → summary appears; button labels): **not yet done** — developer to verify.
- Credit cost per summary: not measured yet.

---

## 2026-11-21 — AI summary verified live; cost measured; deployed

### Developer
- **Browser-verified:** marking "How do I solved this?" (5/x = 10) solved produced the summary automatically. The summary correctly reports that a first reply said x = 2, a later reply corrected it to x = 0.5, and that the thread was resolved with the correction (grounded in the thread; the newest replies were kept).
- **Measured cost** (DeepSpace dashboard, Recent API Usage): each summary shows two `anthropic / proxy` rows, +$0.0002 and −$0.0001 (meaning of the negative row not confirmed; net ≈ $0.0001 per summary). The 30-day usage chart rounds to $0.00.
- Committed `16d5fa9` and deployed: live release 6 serves `16d5fa9` (agent confirmed via `npx deepspace status --json`).

### Agent
- Interpreted the dashboard numbers; recorded them as measured.

### Verification
- Last agent run: `npm run type-check` clean, `npm run test:unit` 134/134 (before commit; no code changed since).
- Feature status: all planned features (My Questions, 7-day cron, presence, AI summary) are live. The live cron run (`[cron] mark-inactive ok` in `npx deepspace logs`) has not been reported yet.

---

## 2026-11-21 — Navigation + real Home/landing (agent-implemented at developer's request)

### Developer
- Pointed out the app had no way to navigate (no Rooms / My Questions links) and the Home and landing pages were still scaffold placeholders. Asked the agent to implement them using the "taste" design skill.

### Agent (wrote this code)
- Used the installed `design-taste-frontend` skill's rules that fit an app (clear headline with a real fact, verb+object buttons, hover/press/focus states, 44px tap targets, no invented testimonials or stats), not its static-site kit or browser gate — kept the app's existing tokens and the look of the already-styled pages.
- `src/nav.ts`: Home, Rooms, My questions (`roles: ['member']`, so signed-out visitors don't see it); removed the scaffold Settings link (page still exists).
- `src/constants.ts`: `APP_NAME` display name `StuckRoom`.
- `src/components/Navigation.tsx`: brand icon, active-link state, larger tap targets, press feedback; kept all `data-testid` hooks.
- `src/pages/(app)/home.tsx`: rewritten — headline + explanation, Ask/Browse actions (signed out: "Sign in to ask" opens `AuthOverlay`), ask card with `NewQuestionForm`, live "Latest rooms" list (`useQuery` public, newest 5), "How a room works" (3 steps, all describing implemented behavior).
- `src/components/NewQuestionForm.tsx`: styling, `Input` for the title, placeholders, character count, "Post question" label; submit logic unchanged.
- `src/pages/index.tsx` + `src/seo.ts`: static landing copy and SEO description replaced; `data-testid="static-landing"` and `<Seo>` kept.

### Verification
- `npm run type-check` clean; eslint clean on all 7 files; `npm run test:unit` **134 passed (134)** (includes the prerender test for `/`).
- **Not visually checked by the agent** (no browser run); developer to check desktop + phone width.
