import { useQuery } from "deepspace";
import type { Question } from "../../../types";
import { Link } from "@/router";

export default function Rooms() {
  const { records, status, error } = useQuery<Question>("question", {
    where: { visibility: "public" },
    orderBy: "createdAt",
    orderDir: "desc",
  });

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  if (status === "error") {
    return <p>{error}</p>;
  }

  return (
    <div>
      <p>Found {records.length} questions</p>
      {records.map((record) => {
        return (
          <Link
            key={record.recordId}
            to="/rooms/:id"
            params={{ id: record.recordId }}
          >
            <p>Title: {record.data.title}</p>
            <p>Status: {record.data.status}</p>
            <p>Created At: {record.createdAt}</p>
            <p>{record.data.content}</p>
          </Link>
        );
      })}
    </div>
  );
}
