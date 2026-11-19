import { useNavigate } from "@/router";
import type { Question } from "@/types";
import { useMutations } from "deepspace";
import { useState, SubmitEvent } from "react";
import { Textarea } from "./ui";

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
    <form onSubmit={handleCreate}>
      <div>
        <label htmlFor="title">Title</label>
        <Textarea
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
        />
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          required
        />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting || !ready}>
        Submit
      </button>
    </form>
  );
}
