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
import { getLogsForPond } from "../services/local-daily-logs";
import { getPondById, type StoredPond } from "../services/local-ponds";

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
  const { pondId } = useLocalSearchParams<{ pondId: string }>();
  const [pond, setPond] = useState<StoredPond | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    const [pondData, logs] = await Promise.all([
      getPondById(pondId),
      getLogsForPond(pondId),
    ]);

    setPond(pondData);
    setLogCount(logs.length);
    setIsLoading(false);
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    setProgress(0);

    const timer = setInterval(() => {
      setProgress((current) => {
        if (current >= 99) {
          clearInterval(timer);
          return 99;
        }

        if (current < 72) {
          return current + 9;
        }

        if (current < 90) {
          return current + 3;
        }

        return current + 1;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [isLoading, pondId]);

  const cycleDays = useMemo(() => {
    const dayValue = Number(pond?.cycleDay ?? "0");
    return Number.isFinite(dayValue) && dayValue > 0 ? dayValue : 0;
  }, [pond]);

  const pipeline: { label: string; status: PipelineStatus }[] = useMemo(
    () => [
      {
        label: "Water parameters",
        status: logCount > 0 ? "Complete" : "Waiting",
      },
      {
        label: "Feed efficiency",
        status: pond?.biomass && pond.biomass !== "—" ? "Complete" : "Waiting",
      },
      {
        label: "Expense logs",
        status: "Waiting",
      },
    ],
    [logCount, pond],
  );

  const handleCancel = () => {
    router.back();
  };

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>
            Pond ID: {pond?.pondName || pond?.name || "Alpha-01"}
          </Text>

          <View style={styles.helpBadge}>
            <Feather name="help-circle" size={14} color={colors.primary} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Generating your cycle report...</Text>
            <Text style={styles.heroBody}>
              Please wait while we synthesize your pond's performance data into
              a comprehensive document.
            </Text>
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
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel Generation</Text>
          </Pressable>
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
