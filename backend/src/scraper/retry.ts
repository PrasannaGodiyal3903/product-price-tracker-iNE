/**
 * Exponential backoff utility with jitter
 */
export function getBackoffDelay(
  attempt: number,
  baseDelayMs: number = 1500,
  multiplier: number = 2.0,
  jitterMs: number = 200
): number {
  const expDelay = baseDelayMs * Math.pow(multiplier, attempt - 1);
  const randomJitter = (Math.random() * 2 - 1) * jitterMs;
  return Math.max(200, Math.round(expDelay + randomJitter));
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
