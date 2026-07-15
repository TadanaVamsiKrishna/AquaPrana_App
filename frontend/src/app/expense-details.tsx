import { useCallback, useMemo, useState } from "react";
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
import {
  buildExpenseChartSegments,
  ExpenseDonutChart,
} from "../components/expense-donut-chart";
import { formatCurrency } from "../lib/expense-format";
import { resolvePondId } from "../lib/pond-route";
import { getActiveCropCycleForPond } from "../services/cropCycle";
import {
  formatExpenseUpdatedAt,
  getCycleExpensesByCycleId,
  type CycleExpenseRecord,
} from "../services/cycleExpensesService";
import { getSupabasePondById } from "../services/pond";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  chartFeed: "#0646A8",
  chartSeed: "#0A84FF",
  chartLabour: "#14B8A6",
  chartTreatment: "#EF4444",
  chartOther: "#94A3B8",
};

const formatCompactTotal = (value: number) => {
  if (value >= 100000) {
    return `₹ ${(value / 100000).toFixed(1)}L`;
  }

  return formatCurrency(value);
};

export default function ExpenseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pondId: string }>();
  const pondId = resolvePondId(params.pondId);

  const [pondName, setPondName] = useState("Pond");
  const [expenses, setExpenses] = useState<CycleExpenseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [pond, activeCycle] = await Promise.all([
        getSupabasePondById(pondId),
        getActiveCropCycleForPond(pondId),
      ]);

      setPondName(pond?.name?.trim() || "Pond");

      if (!activeCycle) {
        setExpenses(null);
        setLoadError("No active crop cycle found for this pond.");
        return;
      }

      const cycleExpenses = await getCycleExpensesByCycleId(activeCycle.id);
      setExpenses(cycleExpenses);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load expense details.",
      );
      setExpenses(null);
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const chartSegments = useMemo(
    () =>
      buildExpenseChartSegments([
        {
          label: "Feed",
          value: expenses?.feed_cost ?? 0,
          color: colors.chartFeed,
        },
        {
          label: "Seed",
          value: expenses?.seed_cost ?? 0,
          color: colors.chartSeed,
        },
        {
          label: "Labour",
          value: expenses?.labour_cost ?? 0,
          color: colors.chartLabour,
        },
        {
          label: "Treatment",
          value: expenses?.treatment_cost ?? 0,
          color: colors.chartTreatment,
        },
        {
          label: "Other",
          value: expenses?.other_cost ?? 0,
          color: colors.chartOther,
        },
      ]),
    [expenses],
  );

  const breakdownItems = [
    {
      icon: "package" as const,
      label: "Feed",
      note: "Qty × Price",
      amount: expenses?.feed_cost ?? 0,
    },
    {
      icon: "droplet" as const,
      label: "Seed",
      note: "Count × Price/1k",
      amount: expenses?.seed_cost ?? 0,
    },
    {
      icon: "users" as const,
      label: "Labour",
      note: "Cost/Day × Days",
      amount: expenses?.labour_cost ?? 0,
    },
    {
      icon: "activity" as const,
      label: "Treatment",
      note: "Unit Price × Qty",
      amount: expenses?.treatment_cost ?? 0,
    },
    {
      icon: "layers" as const,
      label: "Other",
      note: "Manual expenses",
      amount: expenses?.other_cost ?? 0,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{pondName}</Text>
          <View style={styles.iconButton} />
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Expense details unavailable</Text>
            <Text style={styles.emptyBody}>{loadError}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Expense</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(expenses?.total_cost ?? 0)}
              </Text>
              <Text style={styles.totalMeta}>
                Cost/kg:{" "}
                {expenses?.cost_per_kg != null
                  ? `₹ ${expenses.cost_per_kg.toFixed(2)}`
                  : "—"}
              </Text>
              <Text style={styles.totalMeta}>
                Updated {formatExpenseUpdatedAt(expenses?.computed_at)}
              </Text>
            </View>

            <View style={styles.chartCard}>
              <ExpenseDonutChart
                totalLabel="Total"
                centerValue={formatCompactTotal(expenses?.total_cost ?? 0)}
                segments={chartSegments}
              />
            </View>

            <Text style={styles.sectionTitle}>Breakdown</Text>
            {breakdownItems.map((item) => (
              <View key={item.label} style={styles.breakdownCard}>
                <View style={styles.breakdownIcon}>
                  <Feather name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.breakdownCopy}>
                  <Text style={styles.breakdownTitle}>{item.label}</Text>
                  <Text style={styles.breakdownNote}>({item.note})</Text>
                </View>
                <Text style={styles.breakdownAmount}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  totalCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  totalLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "700",
  },
  totalValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
  },
  totalMeta: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "600",
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  breakdownCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  breakdownIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E8F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownCopy: {
    flex: 1,
    gap: 2,
  },
  breakdownTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  breakdownNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  breakdownAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
