export const now = (): number => Date.now();

export function isExpired(startEpochMs: number, durationMs: number): boolean {
  return now() - startEpochMs > durationMs;
}
