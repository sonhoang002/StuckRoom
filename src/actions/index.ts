import type { ActionHandler } from "deepspace/worker";
import type { Env } from "../../worker";

export const actions: Record<string, ActionHandler<Env>> = {
  markSolved: async (ctx) => {
    const questionId = ctx.params.questionId;

    if (typeof questionId !== "string" || questionId.length === 0) {
      return {
        success: false,
        error: "Missing or invalid questionId",
      };
    }

    const questionResult = await ctx.tools.get("question", questionId);

    if (!questionResult.success) {
      return questionResult;
    }

    if (questionResult.data.record.createdBy !== ctx.userId) {
      return {
        success: false,
        error: "Only the question's owner can mark it solved",
      };
    }

    const updatedAction = await ctx.tools.update("question", questionId, {
      status: "solved",
      visibility: "public",
    });

    return updatedAction;
  },

  reopen: async (ctx) => {
    const questionId = ctx.params.questionId;

    if (typeof questionId !== "string" || questionId.length === 0) {
      return {
        success: false,
        error: "Missing or invalid questionId",
      };
    }

    const questionResult = await ctx.tools.get("question", questionId);

    if (!questionResult.success) {
      return questionResult;
    }

    if (questionResult.data.record.createdBy !== ctx.userId) {
      return {
        success: false,
        error: "Only the question's owner can reopen it",
      };
    }

    const updatedAction = await ctx.tools.update("question", questionId, {
      status: "active",
      visibility: "public",
      lastActiveDate: new Date().toISOString(),
    });

    return updatedAction;
  },

  postReply: async (ctx) => {
    const questionId = ctx.params.questionId;
    const content = ctx.params.content;
    const replyToId = ctx.params.replyToId;

    if (
      typeof questionId !== "string" ||
      questionId.trim().length === 0 ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return {
        success: false,
        error: "Invalid questionId or content",
      };
    }

    if (
      replyToId !== undefined &&
      (typeof replyToId !== "string" || replyToId.trim().length === 0)
    ) {
      return {
        success: false,
        error: "Invalid replyToId",
      };
    }

    const questionResult = await ctx.tools.get("question", questionId);

    if (!questionResult.success) {
      return questionResult;
    }

    if (
      questionResult.data.record.data.visibility === "private" &&
      questionResult.data.record.createdBy !== ctx.userId
    ) {
      return {
        success: false,
        error:
          "Only the question's owner can post a reply to a private question",
      };
    }

    if (replyToId !== undefined) {
      const replyResult = await ctx.tools.get("reply", replyToId);

      if (!replyResult.success) {
        return replyResult;
      }

      if (replyResult.data.record.data.questionId !== questionId) {
        return {
          success: false,
          error: "Reply belongs to another question",
        };
      }

      if (replyResult.data.record.data.replyToId) {
        return {
          success: false,
          error: "Cannot reply to a nested reply",
        };
      }
    }

    const createdReply = await ctx.tools.create("reply", {
      content,
      questionId,
      replyToId: replyToId ?? "",
    });

    if (!createdReply.success) {
      return createdReply;
    }

    if (
      questionResult.data.record.createdBy === ctx.userId &&
      questionResult.data.record.data.status !== "solved"
    ) {
      const updatedQuestion = await ctx.tools.update("question", questionId, {
        status: "active",
        visibility: "public",
        lastActiveDate: new Date().toISOString(),
      });

      if (!updatedQuestion.success) {
        console.error(
          "postReply: clock update failed",
          questionId,
          updatedQuestion.error,
        );
      }
    }

    return createdReply;
  },
};
