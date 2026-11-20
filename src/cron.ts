/**
 * Cron task definitions — registered into the AppCronRoom DO at construction
 * time (worker.ts). The DO alarm fires `runTask(name, env)` on the schedule
 * declared here; the DO itself records executions, tracks history, and
 * pushes status to admin clients via the `/ws/cron/:roomId` WebSocket.
 *
 * Each task declares EITHER `intervalMinutes` (run every N minutes) OR
 * `schedule` + `timezone` (5-field cron expression). CronRoom validates
 * the config at construction time and throws on ambiguous declarations.
 *
 * Example:
 *
 *   import type { CronTask } from 'deepspace/worker'
 *   import { buildCronContext } from 'deepspace/worker'
 *
 *   export const tasks: CronTask[] = [
 *     { name: 'heartbeat', intervalMinutes: 1 },
 *     { name: 'daily-report', schedule: '0 9 * * *', timezone: 'America/New_York' },
 *   ]
 *
 *   export async function runTask(name: string, env: Env): Promise<void> {
 *     const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
 *     if (name === 'heartbeat') {
 *       // …
 *     }
 *   }
 */

import type { CronTask } from "deepspace/worker";
import { buildCronContext } from "deepspace/worker";
import type { Env } from "../worker";
import { isInactive } from "./lib/inactivity";

export const tasks: CronTask[] = [
  { name: "mark-inactive", intervalMinutes: 60 },
];

function toCandidate(
  row: unknown,
): { recordId: string; lastActive: Date } | null {
  if (typeof row !== "object" || row === null) {
    return null;
  }

  if (!("recordId" in row) || typeof row.recordId !== "string") {
    return null;
  }

  if (!("createdAt" in row) || typeof row.createdAt !== "string") {
    return null;
  }

  if (
    !("data" in row) ||
    typeof row.data !== "object" ||
    row.data === null ||
    Array.isArray(row.data)
  ) {
    return null;
  }

  const lastActiveDate =
    "lastActiveDate" in row.data ? row.data.lastActiveDate : undefined;

  const dateValue = lastActiveDate ?? row.createdAt;

  if (typeof dateValue !== "string") {
    return null;
  }

  const lastActive = new Date(dateValue);

  if (Number.isNaN(lastActive.getTime())) {
    return null;
  }

  return {
    recordId: row.recordId,
    lastActive,
  };
}

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== "mark-inactive") {
    return;
  }

  const ctx = buildCronContext(
    env,
    env.OWNER_USER_ID,
    `app:${env.DEEPSPACE_APP_ID}`,
  );

  const rows = await ctx.records.query("question", {
    where: { status: "active" },
    limit: 50,
  });

  const timeNow = new Date();
  let failed = 0;

  for (const row of rows) {
    const result = toCandidate(row);

    if (result === null) {
      continue;
    }

    if (!isInactive(result.lastActive, timeNow)) {
      continue;
    }

    try {
      await ctx.records.update("question", result.recordId, {
        status: "inactive",
        visibility: "private",
      });
    } catch (err) {
      failed++;
      console.error(
        `Failed to update question ${result.recordId ?? "unknown"}:`,
        err,
      );
    }
  }

  if (failed > 0) {
    throw new Error(`Failed to update ${failed} inactive question(s)`);
  }
}
