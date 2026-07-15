import { Linking, Platform, Share } from "react-native";
import { supabase } from "../lib/supabase";

export type CycleReportResult = {
  signedUrl: string;
  reportTitle: string;
  generatedAt: string;
  storagePath?: string;
};

type GenerateCycleReportResponse = CycleReportResult & {
  error?: string;
};

export async function generateCycleReport(
  cycleId: string,
): Promise<CycleReportResult> {
  const { data, error } = await supabase.functions.invoke<GenerateCycleReportResponse>(
    "generate-cycle-report",
    {
      body: { cycleId },
    },
  );

  if (error) {
    throw new Error(error.message ?? "Failed to generate cycle report.");
  }

  if (!data) {
    throw new Error("No response received from report generator.");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.signedUrl) {
    throw new Error("Report generated but no download URL was returned.");
  }

  return {
    signedUrl: data.signedUrl,
    reportTitle: data.reportTitle ?? "Cycle Report",
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    storagePath: data.storagePath,
  };
}

export async function openCycleReport(url: string) {
  const canOpen = await Linking.canOpenURL(url);

  if (!canOpen) {
    throw new Error("Unable to open the report on this device.");
  }

  await Linking.openURL(url);
}

export async function shareCycleReport(
  url: string,
  title = "AquaPrana Cycle Report",
) {
  if (Platform.OS === "web") {
    await openCycleReport(url);
    return;
  }

  await Share.share({
    title,
    message: url,
    url,
  });
}

export async function generateAndOpenCycleReport(cycleId: string) {
  const report = await generateCycleReport(cycleId);
  await openCycleReport(report.signedUrl);
  return report;
}
