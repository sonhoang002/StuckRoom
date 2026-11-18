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
