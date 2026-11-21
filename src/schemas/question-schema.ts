import { type CollectionSchema } from "deepspace/schema";

export const questionSchema: CollectionSchema = {
  name: "question",
  columns: [
    {
      name: "title",
      storage: "text",
      interpretation: "plain",
      required: true,
      maxLength: 255,
    },
    {
      name: "content",
      storage: "text",
      interpretation: "plain",
      required: true,
      maxLength: 1000,
    },
    {
      name: "status",
      storage: "text",
      interpretation: {
        kind: "select",
        options: ["active", "inactive", "solved"],
      },
      default: "active",
    },
    {
      name: "visibility",
      storage: "text",
      interpretation: {
        kind: "select",
        options: ["public", "private"],
      },
      default: "public",
    },
    {
      name: "lastActiveDate",
      storage: "text",
      interpretation: { kind: "datetime" },
    },
    {
      name: "summary",
      storage: "text",
      interpretation: "plain",
    },
  ],
  visibilityField: "visibility",
  permissions: {
    "*": { read: "published", create: false, update: false, delete: false },
    viewer: { read: "published", create: false, update: false, delete: false },
    member: {
      read: "published",
      create: true,
      update: "own",
      delete: "own",
      writableFields: ["title", "content"],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
};
