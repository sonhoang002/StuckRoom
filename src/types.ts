export type Question = {
  title: string;
  content: string;
  status: "active" | "inactive" | "solved";
  visibility: "public" | "private";
  lastActiveDate?: string | null;
  summary?: string;
};

export type Reply = {
  content: string;
  questionId: string;
  replyToId?: string;
};
