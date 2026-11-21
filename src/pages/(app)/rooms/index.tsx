import { useQuery } from "deepspace";
import type { Question } from "../../../types";
import { Link } from "@/router";
import { formatDate } from "@/lib/formatDate";
import { ArrowUpRight, MessageSquare } from "lucide-react";

const statusStyles = {
  active: "border-info/30 bg-info/10 before:bg-info",
  inactive: "border-border bg-muted before:bg-muted-foreground",
  solved: "border-success/30 bg-success/10 before:bg-success",
};

export default function Rooms() {
  const { records, status, error } = useQuery<Question>("question", {
    where: { visibility: "public" },
    orderBy: "createdAt",
    orderDir: "desc",
  });

  if (status === "loading") {
    return (
      <p
        role="status"
        className="mx-auto max-w-5xl px-6 py-16 text-base text-muted-foreground"
      >
        Loading questions...
      </p>
    );
  }

  if (status === "error") {
    return (
      <p
        role="alert"
        className="mx-auto my-8 max-w-5xl break-words rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-base"
      >
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <header className="mb-8 border-b border-border pb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden="true" />
          <span>Community discussions</span>
        </div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          Rooms
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          Explore questions, share what you know, and work through problems
          together.
        </p>
      </header>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">Latest questions</h2>
        <p className="text-sm text-muted-foreground">
          {records.length} {records.length === 1 ? "question" : "questions"}
        </p>
      </div>
      <div className="space-y-4">
        {records.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
            <MessageSquare
              className="mx-auto mb-4 size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium">No public questions yet</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Public questions will appear here when they are posted.
            </p>
          </div>
        )}
        {records.map((record) => {
          return (
            <Link
              key={record.recordId}
              to="/rooms/:id"
              params={{ id: record.recordId }}
              className="group block min-w-0 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/50 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium capitalize before:size-1.5 before:rounded-full ${statusStyles[record.data.status]}`}
                >
                  {record.data.status}
                </span>
                <time
                  dateTime={record.createdAt}
                  className="text-sm text-muted-foreground"
                >
                  {formatDate(record.createdAt)}
                </time>
              </div>
              <div className="flex items-start justify-between gap-4">
                <h3 className="min-w-0 text-xl font-medium tracking-tight [overflow-wrap:anywhere]">
                  {record.data.title}
                </h3>
                <ArrowUpRight
                  className="mt-1 size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-base leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                {record.data.content}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
