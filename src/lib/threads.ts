import type { Reply } from "@/types";
import type { RecordData } from "deepspace";

export type Group = {
  reply: RecordData<Reply>;
  children: RecordData<Reply>[];
};

export function groupReplies(replies: RecordData<Reply>[]): Group[] {
  const groupMap = new Map<string, Group>();

  for (const reply of replies) {
    if (!reply.data.replyToId) {
      groupMap.set(reply.recordId, {
        reply,
        children: [],
      });
    }
  }

  for (const reply of replies) {
    if (reply.data.replyToId) {
      const parent = groupMap.get(reply.data.replyToId);

      if (parent) {
        parent.children.push(reply);
      } else {
        groupMap.set(reply.recordId, {
          reply,
          children: [],
        });
      }
    }
  }

  return Array.from(groupMap.values());
}
