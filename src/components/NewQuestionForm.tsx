import { useNavigate } from "@/router";
import type { Question } from "@/types";
import { useMutations } from "deepspace";
import { useState, SubmitEvent } from "react";
import { Input, Textarea } from "./ui";

type NewQuestion = Pick<Question, "title" | "content">;

export default function NewQuestionForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { createConfirmed, ready } = useMutations<NewQuestion>("question");
  const navigate = useNavigate();

  const handleCreate = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (title.trim() === "" || content.trim() === "") {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const result = await createConfirmed({
        title: title.trim(),
        content: content.trim(),
      });

      setTitle("");
      setContent("");

      navigate("/rooms/:id", { params: { id: result } });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create question",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium">
          Title
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          placeholder="e.g. Why does my while loop never end?"
          className="h-11 bg-background text-base"
        />
      </div>

      <div>
        <label htmlFor="content" className="mb-2 block text-sm font-medium">
          What you tried
        </label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          required
          placeholder="Share the problem, what you expected, and what happened instead."
          className="min-h-32 resize-y bg-background p-4 text-base leading-7"
        />
        <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
          {content.length} / 1000
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !ready}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "Posting..." : "Post question"}
      </button>
    </form>
  );
}
