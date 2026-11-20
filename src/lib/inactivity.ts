export const INACTIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isInactive(lastActive: Date, now: Date): boolean {
  const timePassed: number = Math.round(now.getTime() - lastActive.getTime());

  return timePassed >= INACTIVE_AFTER_MS;
}
