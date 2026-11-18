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

    const getActionData = await ctx.tools.get("question", questionId);

    if (!getActionData.success) {
      return getActionData;
    }

    if (getActionData.data.record.createdBy !== ctx.userId) {
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
};
