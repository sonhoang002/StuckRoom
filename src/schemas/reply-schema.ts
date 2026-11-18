import { type CollectionSchema } from "deepspace/schema";

export const replySchema: CollectionSchema = {
  name: "reply",
  columns: [
    { name: "content", storage: "text", interpretation: "plain" },
    {
      name: "questionId",
      storage: "text",
      interpretation: {
        kind: "reference",
        targetTable: "question",
        displayColumn: "title",
      },
      required: true,
      immutable: true,
    },
    {
      name: "replyToId",
      storage: "text",
      interpretation: {
        kind: "reference",
        targetTable: "reply",
        displayColumn: "content",
      },
    },
  ],
  permissions: {
    "*": { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: {
      read: true,
      create: false,
      update: "own",
      delete: "own",
      writableFields: ["content"],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
};
