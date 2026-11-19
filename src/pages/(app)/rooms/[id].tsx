import { useParams } from "@/router";
import type { Reply, Question } from "@/types";
import { useQuery } from "deepspace";
import { useUserLookup } from "deepspace";

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
  const { getName } = useUserLookup();

  if (questionStatus === "loading" || repliesStatus === "loading") {
    return <p>Loading...</p>;
  }

  if (questionStatus === "error") {
    return <p>{questionError}</p>;
  }

  if (repliesStatus === "error") {
    return <p>{repliesError}</p>;
  }

  if (questionStatus === "ready" && !questions[0]) {
    return <p>Question not found</p>;
  }

  return (
    <>
      <div>
        <h1>{questions[0].data.title}</h1>
        <p>{questions[0].data.content}</p>
      </div>
      {replies.length > 0 ? (
        replies.map((reply) => (
          <div key={reply.recordId}>
            <p>{getName(reply.createdBy)}</p>
            <p>{reply.createdAt}</p>
            <h1>{reply.data.content}</h1>
          </div>
        ))
      ) : (
        <p>No reply at this momment.</p>
      )}
    </>
  );
}
