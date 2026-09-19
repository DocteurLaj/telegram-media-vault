export function normalizeBackfillLimit(value: unknown): number {
  const parsed = Number(value ?? 100);
  if (!Number.isInteger(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 1000);
}
