import type { Router } from "expo-router";

export function navigateBackToHome(router: Router) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/home" as never);
}

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
