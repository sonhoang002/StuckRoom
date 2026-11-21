import { usePresenceRoom } from "deepspace";

export default function ThreadPresence({ questionId }: { questionId: string }) {
  const { peers, connected } = usePresenceRoom(`question:${questionId}`);

  if (!connected) {
    return null;
  }

  if (peers.length === 0) {
    return <div>Just you here</div>;
  }

  return <div>Also here: {peers.map((peer) => peer.userName).join(", ")}</div>;
}
