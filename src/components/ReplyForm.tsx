import { Textarea } from "./ui";
import { callAction } from "@/lib/actions";
import { useState, useId } from "react";
import type { SubmitEvent } from "react";

type ReplyFormProps = {
  questionId: string;
  replyToId?: string;
  onSuccess?: () => void;
};

export default function ReplyForm({
  questionId,
  replyToId,
  onSuccess,
}: ReplyFormProps) {
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fieldId = useId();

  const handleCreate = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (content.trim() === "") {
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await callAction("postReply", {
      questionId,
      content: content.trim(),
      replyToId,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setContent("");
    onSuccess?.();
  };

  return (
    <form onSubmit={handleCreate}>
      <div>
        <label htmlFor={fieldId}>Your Reply</label>
        <Textarea
          id={fieldId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          required
        />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>
        Submit
      </button>
    </form>
  );
}
