import { useUser, useQuery } from "deepspace";
import { Link } from "@/router";
import type { Question } from "@/types";
import { useState } from "react";
import { callAction } from "@/lib/actions";

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
    return <p>Loading...</p>;
  }

  if (status === "error") {
    return <p>{questionError}</p>;
  }

  const handleMarkSolved = async (recordId: string) => {
    setSubmitting(true);
    setError("");

    const result = await callAction("markSolved", { questionId: recordId });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
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

  return (
    <div>
      <p>Found {records.length} questions</p>
      {error && <p role="alert">{error}</p>}
      {records.map((record) => {
        return (
          <div key={record.recordId}>
            <Link to="/rooms/:id" params={{ id: record.recordId }}>
              <p>Title: {record.data.title}</p>
            </Link>
            <p>Status: {record.data.status}</p>
            <p>Visibility: {record.data.visibility}</p>
            <p>Created At: {record.createdAt}</p>
            <p>{record.data.content}</p>

            {record.data.status === "active" ? (
              <button
                type="button"
                onClick={() => handleMarkSolved(record.recordId)}
                disabled={submitting}
              >
                Mark Solved
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleReopen(record.recordId)}
                disabled={submitting}
              >
                Reopen
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyQuestionPage() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <p>Sign in to view your questions</p>;
  }

  return <MyQuestionList userId={user.id}></MyQuestionList>;
}
