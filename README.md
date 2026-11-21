# StuckRoom

Live Q&A study rooms. Post the problem you're stuck on, work through it with other people in real time, and once it's solved, an AI summary records the fix for the next person who hits the same problem.

**Live:** https://stuckroom.app.space

Built on [DeepSpace](https://docs.deep.space) as a five-day build exercise (2026-11-17 → 2026-11-21).

## What it does

- **Ask a question.** Every question gets its own room (thread) and opens as **active** and **public**.
- **Discuss it live.** Replies show up for everyone in the room without a refresh. Replies can nest one level deep (you can reply to a comment, but not to a reply).
- **See who's in the room.** Each thread shows who else is viewing it right now. Signed-out visitors appear as "Anonymous".
- **Mark it solved.** The asker marks the question solved from **My questions**. It stays public, and an AI summary of the problem and its fix appears on the thread. The asker can regenerate the summary, or reopen the question.
- **Stale questions go private.** If the asker hasn't been active for **7 days**, an hourly job marks the question **inactive** and **private**. A reply from the asker, or an explicit reopen, makes it active and public again.

Signed-out visitors can read active and solved questions. Posting, replying, and managing your own questions all require sign-in.

## DeepSpace integrations

| Integration | Where | Why |
|---|---|---|
| **Auth** (`useAuthProfileReady`, `AuthGate`, `AuthOverlay`) | Navigation, `(protected)` routes | Sign-in, plus anonymous read access for visitors |
| **Records + server-enforced permissions** (schemas, `'own'`, `writableFields`, `visibilityField`) | `src/schemas/` | Visibility and ownership rules are enforced by the server, not just hidden in the UI |
| **Realtime queries** (`useQuery`) | Rooms, thread, My questions, Home | Replies and status changes appear live in every open window |
| **Server actions** | `src/actions/index.ts` | Writes that need to check or change *another* record, or restrict *values* (`markSolved`, `reopen`, `postReply`, `summarize`) |
| **Cron** (`CronRoom`, `buildCronContext`) | `src/cron.ts` | Enforces the 7-day inactivity rule, even when nobody has the app open |
| **Presence rooms** (`usePresenceRoom`) | `src/components/ThreadPresence.tsx` | "Who's here" per thread. It's temporary state, so nothing is written to the database |
| **AI through the DeepSpace proxy** (`createDeepSpaceAI` + `generateText`) | `summarize` action | Solved-thread summaries with `claude-haiku-5-5`. There are no API keys in the app's code |

## Key design decisions

1. **Separate `status` and `visibility` columns.** `visibilityField` matches one exact value, but visitors need to see both *active* and *solved* questions. The cost is that two fields must stay in sync, so every status change goes through a server action.
2. **Status changes happen in server actions, not direct writes.** `update: 'own'` can't restrict *values*, so a direct write would let an owner set `inactive` or `public` themselves. Members can write only `title` and `content` directly.
3. **`postReply` is one server action.** It creates the reply and refreshes the asker's 7-day clock. Two browser calls would leave the clock stale if the tab closed between them. If the clock update fails after the reply was saved, the action still reports success (and logs the error), so the user doesn't resend and create a duplicate reply.
4. **`summarize` is its own action, separate from `markSolved`.** Each action does one job. The page calls `summarize` after a successful `markSolved`. If the model call fails, or the tab closes in between, the question is still solved, and the asker can retry with **Generate summary**.
5. **AI prompt safety and cost.** Thread text is user-written, so the prompt wraps it in `<thread>` delimiters (stripped from user input) and tells the model to treat it as data, not instructions. The thread is capped at 6,000 characters, keeping the question and the *newest* replies (that's where the fix usually is). Output is capped at 1,000 tokens, and only a complete answer is saved: an empty output, or any `finishReason` other than `stop`, is rejected. (A live summary was once cut off mid-sentence at a 300-token cap and saved anyway; the check was added after that.) Measured cost: about **$0.0001 per summary**, net, from the DeepSpace usage dashboard.
6. **The cron fails loudly.** Rows are validated from `unknown` before use. One failed update doesn't stop the run, but the run throws at the end if any update failed, so the cron history shows the failure instead of hiding it in logs.

## Known limitations

- Replies under an inactive (private) question can still be read through a direct query of the `reply` collection (per-reply visibility would add another field to keep in sync).
- Deleting a question doesn't delete its replies. Deleting a comment keeps its child replies, which show "Replying to a deleted comment".
- `postReply` makes two writes (create the reply, then update the question) and isn't atomic.
- The cron handles up to 50 active questions per run (the cron query has no offset).
- The inactive transition hasn't been observed live yet, since no question is 7 days old. It's covered by unit tests with a mocked database.
- Signed-out visitors see authors as "Unknown user".
- There's no UI for editing or deleting a question (permissions allow both for the owner).
- There are no automated UI tests. The UI was verified by hand in the browser.

## What I'd do next

- **Image and PDF attachments.** Some problems are easier to show than to type (a screenshot of an error, a worksheet). DeepSpace's file storage (`useR2Files`) would be the starting point, with size limits and owner-only deletes.
- Hide replies of private questions, and delete a question's replies with it (`tools.deleteWhere`).
- Edit and delete UI for your own questions.
- Show author names to signed-out visitors.

## Run it locally

Requires Node and the DeepSpace CLI (`npx deepspace`).

```bash
npm install
npm run dev          # deepspace dev start
npm run type-check   # tsc --noEmit
npm run test:unit    # Vitest unit tests (139 at the time of writing)
npm run lint
```

Unit tests cover the schemas and permissions, the server actions (the AI model is mocked, so tests spend no credits), the cron job, the reply grouping, the inactivity rule, and the summary prompt builder.

## Project layout

```
src/schemas/           question + reply collections and their permissions
src/actions/index.ts   server actions: markSolved, reopen, postReply, summarize
src/cron.ts            hourly mark-inactive task
src/lib/               callAction (browser), groupReplies, isInactive, buildSummaryPrompt
src/components/        NewQuestionForm, ReplyForm, ThreadPresence, Navigation
src/pages/(app)/       home, rooms list, thread ([id]), (protected)/my-questions
```

## How it was built

I wrote the core application code (schemas, actions, cron, presence, pages) with a coding agent acting as a reviewer. The agent wrote and ran the unit tests and implemented some pieces at my request, mainly the navigation, the home page, and the page wiring for summaries. Part of the page styling came from a second AI tool. `DEV_LOG.md` records each step: what I wrote, what the agent wrote or reviewed, and what was verified, and how.
