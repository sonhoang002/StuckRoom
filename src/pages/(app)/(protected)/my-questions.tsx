import { useUser, useQuery } from "deepspace";
import { Link } from "@/router";
import type { Question } from "@/types";
import { useState } from "react";
import { callAction } from "@/lib/actions";
import { formatDate } from "@/lib/formatDate";
import {
  ArrowUpRight,
  Check,
  Globe,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const statusStyles = {
  active: "border-info/30 bg-info/10 before:bg-info",
  inactive: "border-border bg-muted before:bg-muted-foreground",
  solved: "border-success/30 bg-success/10 before:bg-success",
};

const pageStateClass =
  "mx-auto max-w-5xl px-6 py-16 text-base text-muted-foreground";

type userProp = {
  userId: string;
};

function MyQuestionList({ userId }: userProp) {
  const {
    records,
    status,
    error: questionError,
  } = useQuery<Question>("question", {
    where: { createdBy: userId },
    orderBy: "createdAt",
    orderDir: "desc",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") {
    return (
      <p role="status" className={pageStateClass}>
        Loading your questions...
      </p>
    );
  }

  if (status === "error") {
    return (
      <p
        role="alert"
        className="mx-auto my-8 max-w-5xl break-words rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-base"
      >
        {questionError}
      </p>
    );
  }

  const handleMarkSolved = async (recordId: string) => {
    setSubmitting(true);
    setError("");

    const result = await callAction("markSolved", { questionId: recordId });

    if (!result.success) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    // Decision (b): summarize is its own action, called once markSolved succeeds.
    // If it fails (or the tab closes first), the question stays solved and the
    // owner can retry with the "Generate summary" button.
    const summaryResult = await callAction("summarize", {
      questionId: recordId,
    });
    setSubmitting(false);

    if (!summaryResult.success) {
      setError(
        `Marked as solved, but the summary failed: ${summaryResult.error}`,
      );
    }
  };

  const handleReopen = async (recordId: string) => {
    setSubmitting(true);
    setError("");

    const result = await callAction("reopen", { questionId: recordId });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
  };

  const handleSummarize = async (recordId: string) => {
    setSubmitting(true);
    setError("");

    const result = await callAction("summarize", { questionId: recordId });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <header className="mb-8 border-b border-border pb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden="true" />
          <span>Your discussions</span>
        </div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          My questions
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          Keep track of your questions and mark the problems you have worked
          through.
        </p>
      </header>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">All your questions</h2>
        <p className="text-sm text-muted-foreground">
          {records.length} {records.length === 1 ? "question" : "questions"}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 break-words rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-base"
        >
          {error}
        </p>
      )}
      <div className="space-y-4">
        {records.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
            <MessageSquare
              className="mx-auto mb-4 size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium">No questions yet</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Your questions will appear here when you post them.
            </p>
          </div>
        )}
        {records.map((record) => {
          return (
            <article
              key={record.recordId}
              className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium capitalize before:size-1.5 before:rounded-full ${statusStyles[record.data.status]}`}
                >
                  {record.data.status}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
                  {record.data.visibility === "private" ? (
                    <LockKeyhole className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Globe className="size-3.5" aria-hidden="true" />
                  )}
                  {record.data.visibility}
                </span>
              </div>
              <Link
                to="/rooms/:id"
                params={{ id: record.recordId }}
                className="group flex min-h-11 items-start justify-between gap-4 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <h3 className="min-w-0 text-xl font-medium tracking-tight underline-offset-4 group-hover:underline [overflow-wrap:anywhere]">
                  {record.data.title}
                </h3>
                <ArrowUpRight
                  className="mt-1 size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
              <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                {record.data.content}
              </p>

              <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <time
                  dateTime={record.createdAt}
                  className="text-sm text-muted-foreground"
                >
                  {formatDate(record.createdAt)}
                </time>
                {record.data.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => handleMarkSolved(record.recordId)}
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="size-4" aria-hidden="true" />
                    Mark Solved
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleReopen(record.recordId)}
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reopen
                  </button>
                )}
                {record.data.status === "solved" && (
                  <button
                    type="button"
                    onClick={() => handleSummarize(record.recordId)}
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    {record.data.summary
                      ? "Regenerate summary"
                      : "Generate summary"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function MyQuestionPage() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <p role="status" className={pageStateClass}>
        Loading your questions...
      </p>
    );
  }

  if (!user) {
    return <p className={pageStateClass}>Sign in to view your questions</p>;
  }

  return <MyQuestionList userId={user.id}></MyQuestionList>;
}
