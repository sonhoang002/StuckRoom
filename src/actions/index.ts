import type { ActionHandler } from "deepspace/worker";
import type { Env } from "../../worker";
import type { Question, Reply } from "@/types";
import { buildSummaryPrompt } from "@/lib/summaryPrompt";
import { createDeepSpaceAI } from "deepspace/worker";
import { generateText } from "ai";

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
        error: "Only the question's owner can mark it solved.",
      };
    }

    const updatedAction = await ctx.tools.update("question", questionId, {
      status: "solved",
      visibility: "public",
    });

    return updatedAction;
  },

  summarize: async (ctx) => {
    const questionId = ctx.params.questionId;

    if (typeof questionId !== "string" || questionId.length === 0) {
      return {
        success: false,
        error: "Missing or invalid questionId",
      };
    }

    const questionResult = await ctx.tools.get<Question>(
      "question",
      questionId,
    );

    if (!questionResult.success) {
      return questionResult;
    }

    if (questionResult.data.record.createdBy !== ctx.userId) {
      return {
        success: false,
        error: "Only the question's owner can summarize it.",
      };
    }

    if (questionResult.data.record.data.status !== "solved") {
      return {
        success: false,
        error: "Only solved question can be summarized.",
      };
    }

    const fetchedReplies = await ctx.tools.query<Reply>("reply", {
      where: { questionId },
      orderBy: "createdAt",
      orderDir: "desc",
      limit: 50,
    });

    if (!fetchedReplies.success) {
      return fetchedReplies;
    }

    if (!fetchedReplies.data) {
      return {
        success: false,
        error: "Fetched data is empty.",
      };
    }

    const replies = fetchedReplies.data.records
      .reverse()
      .map((record) => record.data.content);

    const prompt = buildSummaryPrompt(
      {
        title: questionResult.data.record.data.title,
        content: questionResult.data.record.data.content,
      },
      replies,
    );

    try {
      const anthropic = createDeepSpaceAI(ctx.env, "anthropic");
      const { text, finishReason, usage } = await generateText({
        model: anthropic("claude-haiku-5-5"),
        prompt,
        // Caps ALL output tokens, including any hidden reasoning tokens.
        // 300 truncated a live summary mid-sentence (2026-11-21); 1000 leaves room.
        maxOutputTokens: 1000,
      });

      // Diagnostics for `npx deepspace logs`: why the model stopped, and how many
      // output tokens went to visible text vs. reasoning.
      console.log(
        `[summarize] ${questionId} finish=${finishReason} outputTokens=${usage?.outputTokens} reasoningTokens=${usage?.outputTokenDetails?.reasoningTokens}`,
      );

      // Only a natural stop is a complete answer. "length" means the text was
      // cut off; never save a truncated summary as if it were finished.
      if (finishReason !== "stop") {
        throw new Error(`Summary incomplete: finishReason=${finishReason}`);
      }

      if (text.trim() === "") {
        throw new Error("Empty result");
      }

      const updatedAction = await ctx.tools.update("question", questionId, {
        summary: text.trim(),
      });

      return updatedAction;
    } catch (err) {
      console.error(err);
      return {
        success: false,
        error: "Couldn't generate a summary. Try again.",
      };
    }
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
