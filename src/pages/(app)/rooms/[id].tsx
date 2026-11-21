import { Link, useParams } from "@/router";
import type { Reply, Question } from "@/types";
import { useQuery } from "deepspace";
import { useUserLookup } from "deepspace";
import { groupReplies } from "@/lib/threads";
import { formatDate } from "@/lib/formatDate";
import ReplyForm from "@/components/ReplyForm";
import { useAuthProfileReady } from "deepspace";
import ThreadPresence from "@/components/ThreadPresence";

import { useState } from "react";
import {
  ArrowLeft,
  CornerDownRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const statusStyles = {
  active: "border-info/30 bg-info/10 before:bg-info",
  inactive: "border-border bg-muted before:bg-muted-foreground",
  solved: "border-success/30 bg-success/10 before:bg-success",
};

const pageStateClass =
  "mx-auto max-w-5xl px-6 py-16 text-base text-muted-foreground";
const errorClass =
  "mx-auto my-8 max-w-5xl break-words rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-base";
const replyButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
// Style the existing ReplyForm from this page so shared components stay unchanged.
const replyFormClass =
  "[&_form]:space-y-4 [&_label]:mb-2 [&_label]:block [&_label]:text-sm [&_label]:font-medium [&_textarea]:min-h-32 [&_textarea]:resize-y [&_textarea]:bg-background [&_textarea]:p-4 [&_textarea]:text-base [&_textarea]:leading-7 [&_button[type=submit]]:min-h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:rounded-lg [&_button[type=submit]]:bg-foreground [&_button[type=submit]]:px-5 [&_button[type=submit]]:py-2 [&_button[type=submit]]:text-sm [&_button[type=submit]]:font-medium [&_button[type=submit]]:text-background [&_button[type=submit]]:transition-opacity [&_button[type=submit]:hover]:opacity-85 [&_button[type=submit]:focus-visible]:outline-2 [&_button[type=submit]:focus-visible]:outline-offset-4 [&_button[type=submit]:focus-visible]:outline-ring [&_button[type=submit]:disabled]:cursor-not-allowed [&_button[type=submit]:disabled]:opacity-50 [&_[role=alert]]:break-words [&_[role=alert]]:rounded-lg [&_[role=alert]]:border [&_[role=alert]]:border-destructive/30 [&_[role=alert]]:bg-destructive/10 [&_[role=alert]]:p-3 sm:[&_button[type=submit]]:w-auto";

export default function RoomDetail() {
  const { id } = useParams("/rooms/:id");
  const {
    records: questions,
    status: questionStatus,
    error: questionError,
  } = useQuery<Question>("question", {
    where: { recordId: id },
  });
  const {
    records: replies,
    status: repliesStatus,
    error: repliesError,
  } = useQuery<Reply>("reply", {
    where: { questionId: id },
    orderBy: "createdAt",
    orderDir: "asc",
  });
  const groups = groupReplies(replies);
  const question = questions[0];
  const { getName } = useUserLookup();
  const { isSignedIn } = useAuthProfileReady({ requireUser: true });
  const [replyingTo, setReplyingTo] = useState("");

  if (questionStatus === "loading" || repliesStatus === "loading") {
    return (
      <p role="status" className={pageStateClass}>
        Loading discussion...
      </p>
    );
  }

  if (questionStatus === "error") {
    return (
      <p role="alert" className={errorClass}>
        {questionError}
      </p>
    );
  }

  if (repliesStatus === "error") {
    return (
      <p role="alert" className={errorClass}>
        {repliesError}
      </p>
    );
  }

  if (!question) {
    return <p className={pageStateClass}>Question not found</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link
          to="/rooms"
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All rooms
        </Link>
        <div className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <ThreadPresence key={id} questionId={id} />
        </div>
      </div>
      <article className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-8">
        <span
          className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium capitalize before:size-1.5 before:rounded-full ${statusStyles[question.data.status]}`}
        >
          {question.data.status}
        </span>
        <h1 className="text-2xl font-medium leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-4xl sm:leading-tight">
          {question.data.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground [overflow-wrap:anywhere]">
            {getName(question.createdBy) ?? "Unknown user"}
          </span>
          <span aria-hidden="true">/</span>
          <time dateTime={question.createdAt}>
            {formatDate(question.createdAt)}
          </time>
        </div>
        <div className="mt-6 whitespace-pre-wrap border-t border-border pt-6 text-base leading-8 [overflow-wrap:anywhere]">
          {question.data.content}
        </div>
      </article>
      {question.data.summary && (
        <section
          aria-labelledby="summary-heading"
          className="mt-6 min-w-0 rounded-xl border border-success/30 bg-success/10 p-5 sm:p-6"
        >
          <h2
            id="summary-heading"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            AI summary
            <span className="font-normal text-muted-foreground">
              (from when this was solved)
            </span>
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 [overflow-wrap:anywhere]">
            {question.data.summary}
          </p>
        </section>
      )}
      <section className="mt-10" aria-labelledby="replies-heading">
        <div className="mb-5 flex items-center gap-3">
          <MessageSquare
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <h2
            id="replies-heading"
            className="text-xl font-medium tracking-tight"
          >
            Replies
          </h2>
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm tabular-nums text-muted-foreground">
            {replies.length}
          </span>
        </div>
        <div className="space-y-4">
          {groups.length > 0 ? (
            groups.map((group) => (
              <article
                key={group.reply.recordId}
                className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium [overflow-wrap:anywhere]">
                    {getName(group.reply.createdBy) ?? "Unknown user"}
                  </span>
                  <time
                    dateTime={group.reply.createdAt}
                    className="text-muted-foreground"
                  >
                    {formatDate(group.reply.createdAt)}
                  </time>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-base leading-7 [overflow-wrap:anywhere]">
                  {group.reply.data.content}
                </div>
                {group.reply.data.replyToId && (
                  <p className="mt-3 text-sm italic text-muted-foreground">
                    Replying to a deleted comment
                  </p>
                )}
                {/* When user are signed in, allow them to reply */}
                {isSignedIn && !group.reply.data.replyToId && (
                  <button
                    className={`mt-4 ${replyButtonClass}`}
                    onClick={() => setReplyingTo(group.reply.recordId)}
                  >
                    <CornerDownRight className="size-4" aria-hidden="true" />
                    Reply
                  </button>
                )}
                {/* When user target a comment to reply to, show the ReplyForm */}
                {replyingTo === group.reply.recordId && (
                  <div
                    className={`mt-4 rounded-lg border border-border bg-background p-4 sm:p-5 ${replyFormClass}`}
                  >
                    <ReplyForm
                      questionId={id}
                      replyToId={replyingTo}
                      onSuccess={() => setReplyingTo("")}
                    />

                    <button
                      className={`mt-3 w-full sm:w-auto ${replyButtonClass}`}
                      onClick={() => setReplyingTo("")}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <div className="ml-1 space-y-5 border-l-2 border-border pl-4 empty:hidden not-empty:mt-6 sm:ml-3 sm:pl-6">
                  {group.children.map((child) => (
                    <article key={child.recordId} className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="font-medium [overflow-wrap:anywhere]">
                          {getName(child.createdBy) ?? "Unknown user"}
                        </span>
                        <time
                          dateTime={child.createdAt}
                          className="text-muted-foreground"
                        >
                          {formatDate(child.createdAt)}
                        </time>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-base leading-7 [overflow-wrap:anywhere]">
                        {child.data.content}
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-base leading-7 text-muted-foreground">
              No replies yet. Be the first to help work through this question.
            </p>
          )}
        </div>
      </section>
      <section
        className={`mt-8 rounded-xl border border-border bg-card p-5 sm:p-6 ${replyFormClass}`}
        aria-labelledby="reply-heading"
      >
        <h2
          id="reply-heading"
          className="mb-5 text-xl font-medium tracking-tight"
        >
          Join the discussion
        </h2>
        {isSignedIn ? (
          <ReplyForm questionId={id} />
        ) : (
          <p className="text-base text-muted-foreground">Sign in to reply.</p>
        )}
      </section>
    </div>
  );
}
