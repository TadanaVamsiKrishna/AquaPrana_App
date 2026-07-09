import type { Router } from "expo-router";
import { pondHasLogsForActiveCycle } from "../services/local-daily-logs";

export async function navigateToDailyLogEntry(
  router: Router,
  pondId: string,
) {
  const hasLogs = await pondHasLogsForActiveCycle(pondId);

  router.push({
    pathname: "/daily-log-entry",
    params: {
      pondId,
      firstLog: hasLogs ? "false" : "true",
    },
  } as never);
}
