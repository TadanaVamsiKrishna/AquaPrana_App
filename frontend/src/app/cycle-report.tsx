import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLogsForCycle, getLogsForPond } from "../services/dailyLogs";
import {
  getActiveCropCycleForPond,
  getCropCycleById,
  getCycleDayFromRecord,
} from "../services/cropCycle";
import { getSupabasePondById } from "../services/pond";
import {
  generateCycleReport,
  openCycleReport,
  shareCycleReport,
  type CycleReportResult,
} from "../services/reportService";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
  infoSoft: "#EFF6FF",
};

type PipelineStatus = "Complete" | "Waiting";

function getCircleStroke(progress: number) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return {
    radius,
    circumference,
    dashOffset,
  };
}

function ProgressRing({ progress }: { progress: number }) {
  const { radius, circumference, dashOffset } = getCircleStroke(progress);

  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringTrack} />
      <View
        style={[
          styles.ringProgressMask,
          {
            transform: [{ rotate: `${(progress / 100) * 360}deg` }],
          },
        ]}
      >
        <View style={styles.ringProgress} />
      </View>
      <View style={styles.ringCenter}>
        <Feather name="refresh-cw" size={18} color={colors.primary} />
        <Text style={styles.ringValue}>{progress}%</Text>
      </View>
      <Text style={styles.ringHiddenMetric}>
        {radius}-{circumference}-{dashOffset}
      </Text>
    </View>
  );
}

export default function CycleReportScreen() {
  const router = useRouter();
  const { pondId, cycleId } = useLocalSearchParams<{
    pondId: string;
    cycleId?: string;
  }>();
  const [pondName, setPondName] = useState("Pond");
  const [logCount, setLogCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [cycleDays, setCycleDays] = useState(0);
  const [hasBiomassData, setHasBiomassData] = useState(false);
  const [resolvedCycleId, setResolvedCycleId] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<CycleReportResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isOpeningReport, setIsOpeningReport] = useState(false);
  const [isSharingReport, setIsSharingReport] = useState(false);
  const [generationAttempt, setGenerationAttempt] = useState(0);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const pondData = await getSupabasePondById(pondId);
      const cycle = cycleId
        ? await getCropCycleById(cycleId)
        : await getActiveCropCycleForPond(pondId);
      const logs = cycle?.id
        ? await getLogsForCycle(cycle.id)
        : await getLogsForPond(pondId);

      setPondName(pondData?.name?.trim() || "Pond");
      setLogCount(logs.length);
      setCycleDays(getCycleDayFromRecord(cycle) ?? 0);
      setHasBiomassData(
        cycle?.current_biomass_kg != null && cycle.current_biomass_kg > 0,
      );
      setResolvedCycleId(cycle?.id ?? null);
      setReportResult(null);
      setGenerateError(null);

      if (!cycle?.id) {
        setLoadError("No crop cycle found for this report.");
      }
    } catch (error) {
      console.log("[cycle-report] load error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load cycle report data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pondId, cycleId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (isLoading || !resolvedCycleId) {
      return;
    }

    let cancelled = false;

    const runGeneration = async () => {
      setIsGenerating(true);
      setGenerateError(null);
      setProgress(0);

      const progressTimer = setInterval(() => {
        setProgress((current) => (current >= 90 ? current : current + 6));
      }, 250);

      try {
        const result = await generateCycleReport(resolvedCycleId);

        if (cancelled) {
          return;
        }

        setReportResult(result);
        setProgress(100);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setGenerateError(
          error instanceof Error
            ? error.message
            : "Unable to generate cycle report.",
        );
      } finally {
        clearInterval(progressTimer);
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    };

    void runGeneration();

    return () => {
      cancelled = true;
    };
  }, [isLoading, resolvedCycleId, generationAttempt]);

  const handleRetryGeneration = () => {
    setGenerateError(null);
    setReportResult(null);
    setProgress(0);
    setGenerationAttempt((current) => current + 1);
  };

  const pipeline: { label: string; status: PipelineStatus }[] = useMemo(
    () => [
      {
        label: "Water parameters",
        status: logCount > 0 ? "Complete" : "Waiting",
      },
      {
        label: "Feed efficiency",
        status: hasBiomassData ? "Complete" : "Waiting",
      },
      {
        label: "Expense logs",
        status: "Waiting",
      },
    ],
    [logCount, hasBiomassData],
  );

  const handleCancel = () => {
    router.back();
  };

  const handleDownloadReport = async () => {
    if (!reportResult?.signedUrl) {
      return;
    }

    setIsOpeningReport(true);

    try {
      await openCycleReport(reportResult.signedUrl);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Unable to open report.",
      );
    } finally {
      setIsOpeningReport(false);
    }
  };

  const handleShareReport = async () => {
    if (!reportResult?.signedUrl) {
      return;
    }

    setIsSharingReport(true);

    try {
      await shareCycleReport(
        reportResult.signedUrl,
        reportResult.reportTitle ?? "AquaPrana Cycle Report",
      );
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Unable to share report.",
      );
    } finally {
      setIsSharingReport(false);
    }
  };

  const heroTitle = reportResult
    ? "Your cycle report is ready"
    : isGenerating
      ? "Generating your cycle report..."
      : generateError
        ? "Report generation failed"
        : "Preparing your cycle report...";

  const heroBody =
    generateError ??
    (reportResult
      ? `${reportResult.reportTitle} generated successfully. Download or share the PDF below.`
      : "Please wait while we synthesize your pond's performance data into a comprehensive document.");

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loaderScreen}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !resolvedCycleId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loaderScreen}>
          <Text style={styles.heroTitle}>Unable to load report</Text>
          <Text style={[styles.heroBody, { marginTop: 8 }]}>
            {loadError ?? "No crop cycle was found for this report."}
          </Text>
          <Pressable onPress={() => router.back()} style={[styles.cancelButton, { marginTop: 20, width: 200 }]}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Pond ID: {pondName}</Text>

          <View style={styles.helpBadge}>
            <Feather name="help-circle" size={14} color={colors.primary} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroBody}>{heroBody}</Text>
          </View>

          <ProgressRing progress={progress} />

          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={styles.dataLabel}>DATA RANGE DETECTED</Text>
            </View>

            <View style={styles.dataSplit}>
              <View>
                <Text style={styles.dataMeta}>Cycle Length</Text>
                <Text style={styles.dataHint}>
                  Documented {logCount > 0 ? "(1 day ago)" : "(No recent logs)"}
                </Text>
              </View>

              <Text style={styles.dataValue}>
                {cycleDays > 0 ? `>${cycleDays} Days` : "Pending"}
              </Text>
            </View>
          </View>

          <View style={styles.pipelineCard}>
            <Text style={styles.pipelineTitle}>Processing Pipeline</Text>

            {pipeline.map((item) => {
              const isComplete = item.status === "Complete";

              return (
                <View key={item.label} style={styles.pipelineRow}>
                  <View
                    style={[
                      styles.pipelineDot,
                      isComplete ? styles.pipelineDotComplete : styles.pipelineDotWaiting,
                    ]}
                  >
                    {isComplete ? (
                      <Feather name="check" size={12} color={colors.success} />
                    ) : null}
                  </View>

                  <Text style={styles.pipelineLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.pipelineStatus,
                      isComplete
                        ? styles.pipelineStatusComplete
                        : styles.pipelineStatusWaiting,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Feather name="cpu" size={14} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>
              AquaPrana is cross-referencing daily oxygen levels with FCR to
              provide actionable insights for your next cycle.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {reportResult ? (
            <>
              <Pressable
                onPress={handleDownloadReport}
                disabled={isOpeningReport}
                style={styles.primaryButton}
              >
                <Feather name="download" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>
                  {isOpeningReport ? "Opening..." : "Download Report"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShareReport}
                disabled={isSharingReport}
                style={styles.shareButton}
              >
                <Feather name="share-2" size={16} color={colors.primary} />
                <Text style={styles.shareButtonText}>
                  {isSharingReport ? "Sharing..." : "Share Report"}
                </Text>
              </Pressable>
            </>
          ) : generateError ? (
            <>
              <Pressable
                onPress={handleRetryGeneration}
                style={styles.primaryButton}
              >
                <Feather name="refresh-cw" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>Retry Generation</Text>
              </Pressable>
              <Pressable onPress={handleCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Go Back</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleCancel}
              disabled={isGenerating}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>
                {isGenerating ? "Generating..." : "Cancel Generation"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  helpBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 14,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  heroBody: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  ringWrap: {
    alignSelf: "center",
    width: 120,
    height: 120,
    marginTop: 24,
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringTrack: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 6,
    borderColor: "#DBEAFE",
  },
  ringProgressMask: {
    position: "absolute",
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  ringProgress: {
    width: 6,
    height: 48,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: colors.primary,
  },
  ringCenter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ringValue: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  ringHiddenMetric: {
    position: "absolute",
    opacity: 0,
    fontSize: 1,
  },
  dataCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dataLabel: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },
  dataSplit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dataMeta: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  dataHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  dataValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  pipelineCard: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  pipelineTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pipelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pipelineDotComplete: {
    backgroundColor: colors.successSoft,
  },
  pipelineDotWaiting: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pipelineLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  pipelineStatus: {
    fontSize: 11,
    fontWeight: "700",
  },
  pipelineStatusComplete: {
    color: colors.success,
  },
  pipelineStatusWaiting: {
    color: colors.warning,
  },
  infoCard: {
    marginTop: 12,
    backgroundColor: colors.infoSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18,
    backgroundColor: colors.background,
    gap: 10,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  shareButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  cancelButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
});
