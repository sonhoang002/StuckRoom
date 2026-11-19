export type Question = {
  title: string;
  content: string;
  status: "active" | "inactive" | "solved";
  visibility: "public" | "private";
  lastActiveDate?: string | null;
};
