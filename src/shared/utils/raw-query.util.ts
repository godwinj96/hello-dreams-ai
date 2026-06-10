/** Read a numeric aggregate from a TypeORM getRawOne/getRawMany row (handles PG lowercase aliases). */
export function readRawNumber(
  row: Record<string, unknown> | null | undefined,
  key: string,
): number {
  if (!row) return 0;
  const lower = key.toLowerCase();
  const val = row[key] ?? row[lower];
  const num = Number(val ?? 0);
  return Number.isFinite(num) ? num : 0;
}
