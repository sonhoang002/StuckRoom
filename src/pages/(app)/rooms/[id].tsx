import { useParams } from "@/router";
import type { Reply, Question } from "@/types";
import { useQuery } from "deepspace";
import { useUserLookup } from "deepspace";
import { groupReplies } from "@/lib/threads";
import { formatDate } from "@/lib/formatDate";
import ReplyForm from "@/components/ReplyForm";
import { useAuthProfileReady } from "deepspace";
import ThreadPresence from "@/components/ThreadPresence";

import { useState } from "react";

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
    return <p>Loading...</p>;
  }

  if (questionStatus === "error") {
    return <p>{questionError}</p>;
  }

  if (repliesStatus === "error") {
    return <p>{repliesError}</p>;
  }

  if (!question) {
    return <p>Question not found</p>;
  }

  return (
    <>
      <ThreadPresence key={id} questionId={id} />
      <div>
        <h1>{question.data.title}</h1>
        <div>{question.data.content}</div>
        <div>{question.data.status}</div>
        <div>{getName(question.createdBy) ?? "Unknown user"}</div>
        <div>{formatDate(question.createdAt)}</div>
      </div>
      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.reply.recordId}>
            <div>{getName(group.reply.createdBy) ?? "Unknown user"}</div>
            <div>{formatDate(group.reply.createdAt)}</div>
            <div>{group.reply.data.content}</div>
            {group.reply.data.replyToId && (
              <small>Replying to a deleted comment</small>
            )}
            {/* When user are signed in, allow them to reply */}
            {isSignedIn && !group.reply.data.replyToId && (
              <button onClick={() => setReplyingTo(group.reply.recordId)}>
                Reply
              </button>
            )}
            {/* When user target a comment to reply to, show the ReplyForm */}
            {replyingTo === group.reply.recordId && (
              <div>
                <ReplyForm
                  questionId={id}
                  replyToId={replyingTo}
                  onSuccess={() => setReplyingTo("")}
                />

                <button onClick={() => setReplyingTo("")}>Cancel</button>
              </div>
            )}
            <div style={{ marginLeft: "24px" }}>
              {group.children.map((child) => (
                <div key={child.recordId}>
                  <div>{getName(child.createdBy) ?? "Unknown user"}</div>
                  <div>{formatDate(child.createdAt)}</div>
                  <div>{child.data.content}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p>No reply at this moment.</p>
      )}
      {isSignedIn ? <ReplyForm questionId={id} /> : <p>Sign in to reply.</p>}
    </>
  );
}
