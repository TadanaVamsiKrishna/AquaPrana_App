export function resolvePondId(
  pondId: string | string[] | undefined,
): string | null {
  if (!pondId) {
    return null;
  }

  if (Array.isArray(pondId)) {
    return pondId[0] ?? null;
  }

  return pondId;
}
