/**
 * Home: what StuckRoom is, the ask-a-question form (signed in), and the
 * latest public questions (live via useQuery).
 */

import { useState } from "react";
import { AuthOverlay, useAuthProfileReady, useQuery } from "deepspace";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  MessagesSquare,
  PenLine,
  Users,
} from "lucide-react";
import { Link } from "@/router";
import type { Question } from "@/types";
import { formatDate } from "@/lib/formatDate";
import NewQuestionForm from "@/components/NewQuestionForm";

const statusStyles = {
  active: "border-info/30 bg-info/10 before:bg-info",
  inactive: "border-border bg-muted before:bg-muted-foreground",
  solved: "border-success/30 bg-success/10 before:bg-success",
};

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium transition-colors hover:bg-accent active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

const steps = [
  {
    icon: PenLine,
    title: "Ask the question",
    body: "Write what you are stuck on and what you already tried. It opens as a public room.",
  },
  {
    icon: Users,
    title: "Work it out live",
    body: "Replies appear for everyone in the room as they are posted, and you can see who else is reading.",
  },
  {
    icon: CheckCircle2,
    title: "Mark it solved",
    body: "The room stays public with an AI summary of the fix. Rooms with no activity from the asker for 7 days go private.",
  },
];

export default function HomePage() {
  const { isSignedIn } = useAuthProfileReady({ requireUser: true });
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-foreground sm:px-8 sm:py-16">
      <section aria-labelledby="home-heading" className="max-w-3xl">
        <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
          <MessagesSquare className="size-4 text-success" aria-hidden="true" />
          <span>Live Q&amp;A study rooms</span>
        </div>
        <h1
          id="home-heading"
          className="text-4xl font-medium leading-tight tracking-tight sm:text-5xl"
        >
          Stuck on a problem? Ask it in a live room.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Every question gets its own room. Replies show up for everyone the
          moment they are posted, and when the asker marks it solved, an AI
          summary keeps the answer for the next person who gets stuck.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isSignedIn ? (
            <a href="#ask" className={primaryButton}>
              <PenLine className="size-4" aria-hidden="true" />
              Ask a question
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className={primaryButton}
            >
              Sign in to ask
            </button>
          )}
          <Link to="/rooms" className={secondaryButton}>
            Browse open rooms
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          id="ask"
          aria-labelledby="ask-heading"
          className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-5 sm:p-8"
        >
          <h2 id="ask-heading" className="text-xl font-medium tracking-tight">
            Ask a question
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Titles up to 255 characters, details up to 1,000.
          </p>
          <div className="mt-6">
            {isSignedIn ? (
              <NewQuestionForm />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6">
                <p className="text-base leading-7 text-muted-foreground">
                  Sign in to post a question and reply in rooms. You can read
                  every public room without an account.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className={`mt-4 w-full sm:w-auto ${primaryButton}`}
                >
                  Sign in to ask
                </button>
              </div>
            )}
          </div>
        </section>

        <LatestQuestions />
      </div>

      <section aria-labelledby="how-heading" className="mt-16">
        <h2 id="how-heading" className="text-xl font-medium tracking-tight">
          How a room works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="rounded-xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-muted text-sm tabular-nums">
                  {i + 1}
                </span>
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

function LatestQuestions() {
  const { records, status, error } = useQuery<Question>("question", {
    where: { visibility: "public" },
    orderBy: "createdAt",
    orderDir: "desc",
    limit: 5,
  });

  return (
    <section
      aria-labelledby="latest-heading"
      className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="latest-heading" className="text-xl font-medium tracking-tight">
          Latest rooms
        </h2>
        <Link
          to="/rooms"
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          See all
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {status === "loading" && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Loading rooms...
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          className="mt-6 break-words rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {status !== "loading" && status !== "error" && records.length === 0 && (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          No rooms yet. Ask the first question.
        </p>
      )}
      {status !== "loading" && status !== "error" && records.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {records.map((record) => (
            <li key={record.recordId}>
              <Link
                to="/rooms/:id"
                params={{ id: record.recordId }}
                className="group block rounded-md py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize before:size-1.5 before:rounded-full ${statusStyles[record.data.status]}`}
                >
                  {record.data.status}
                </span>
                <span className="block font-medium leading-6 [overflow-wrap:anywhere] group-hover:underline group-hover:underline-offset-4">
                  {record.data.title}
                </span>
                <time
                  dateTime={record.createdAt}
                  className="mt-1 block text-sm text-muted-foreground"
                >
                  {formatDate(record.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
