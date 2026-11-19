import { useParams } from "@/router";

export default function RoomDetail() {
  const { id } = useParams("/rooms/:id");

  return <h1>Rooms ID: {id}</h1>;
}
