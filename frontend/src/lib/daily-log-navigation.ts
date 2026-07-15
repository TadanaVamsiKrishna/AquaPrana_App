import type { Router } from "expo-router";
import { pondHasLogs } from "../services/dailyLogs";

export async function navigateToDailyLogEntry(
  router: Router,
  pondId: string,
) {
  const hasLogs = await pondHasLogs(pondId);

  router.push({
    pathname: "/daily-log-entry",
    params: {
      pondId,
      firstLog: hasLogs ? "false" : "true",
    },
  } as never);
}
