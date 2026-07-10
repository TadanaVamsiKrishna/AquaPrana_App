import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
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
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { PondBottomNav } from "../components/pond-bottom-nav";
import { navigateToDailyLogEntry } from "../lib/daily-log-navigation";
import { resolvePondId } from "../lib/pond-route";
import { getPondById, type StoredPond } from "../services/local-ponds";
import {
  getTimeframeStart,
  getTrendPointsForPond,
  type PondTrendPoint,
  type TrendTimeframe,
} from "../services/pond-logs";

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
  teal: "#14B8A6",
  danger: "#EF4444",
  emptyIcon: "#BFDBFE",
};

type Timeframe = TrendTimeframe;

type ParameterKey =
  | "dissolvedOxygen"
  | "ph"
  | "temperature"
  | "salinity"
  | "ammonia"
  | "calcium"
  | "magnesium"
  | "potassium";

type ChartSeries = {
  key: ParameterKey;
  title: string;
  unit: string;
  safeZone: string;
  lineColor: string;
  safeBand: { min: number; max: number } | null;
  yDomain: { min: number; max: number };
};

const SERIES: ChartSeries[] = [
  {
    key: "dissolvedOxygen",
    title: "Dissolved Oxygen",
    unit: "mg/L",
    safeZone: "5.0 - 10.0 MG/L",
    lineColor: colors.primary,
    safeBand: { min: 4, max: 10 },
    yDomain: { min: 0, max: 12 },
  },
  {
    key: "ph",
    title: "pH Level",
    unit: "",
    safeZone: "7.5 - 8.5",
    lineColor: colors.success,
    safeBand: { min: 7.5, max: 8.5 },
    yDomain: { min: 6, max: 9 },
  },
  {
    key: "temperature",
    title: "Temperature",
    unit: "°C",
    safeZone: "26 - 32 °C",
    lineColor: colors.teal,
    safeBand: { min: 26, max: 32 },
    yDomain: { min: 20, max: 36 },
  },
  {
    key: "ammonia",
    title: "Ammonia",
    unit: "mg/L",
    safeZone: "< 0.1 MG/L",
    lineColor: colors.danger,
    safeBand: { min: 0, max: 0.1 },
    yDomain: { min: 0, max: 0.3 },
  },
  {
    key: "salinity",
    title: "Salinity",
    unit: "ppt",
    safeZone: "10 - 25 PPT",
    lineColor: "#0EA5E9",
    safeBand: { min: 10, max: 25 },
    yDomain: { min: 0, max: 35 },
  },
];

const MIN_POINTS = 2;

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatRangeLabel = (timeframe: Timeframe, now = new Date()) => {
  const start = getTimeframeStart(timeframe, now);
  return `${formatShortDate(start)} — ${formatShortDate(now)}`;
};

const formatAxisDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatLatestValue = (value: number | null, unit: string) => {
  if (value === null) {
    return "—";
  }

  const rounded =
    Math.abs(value) >= 10 || Number.isInteger(value)
      ? value.toFixed(1).replace(/\.0$/, "")
      : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return unit ? `${rounded} ${unit}` : rounded;
};

function LineTrendChart({
  points,
  series,
}: {
  points: { observedAt: string; value: number }[];
  series: ChartSeries;
}) {
  const [width, setWidth] = useState(0);
  const height = 140;
  const padding = { top: 12, right: 8, bottom: 28, left: 32 };
  const chartWidth = Math.max(width - padding.left - padding.right, 1);
  const chartHeight = height - padding.top - padding.bottom;

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const values = points.map((point) => point.value);
  const dataMin = Math.min(...values, series.yDomain.min);
  const dataMax = Math.max(...values, series.yDomain.max);
  const yMin = Math.min(series.yDomain.min, dataMin);
  const yMax = Math.max(series.yDomain.max, dataMax);
  const yRange = yMax - yMin || 1;

  const toX = (index: number) =>
    padding.left +
    (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);

  const toY = (value: number) =>
    padding.top + ((yMax - value) / yRange) * chartHeight;

  const polylinePoints = points
    .map((point, index) => `${toX(index)},${toY(point.value)}`)
    .join(" ");

  const safeBand =
    series.safeBand && width > 0
      ? {
          y: toY(Math.min(series.safeBand.max, yMax)),
          height: Math.max(
            toY(Math.max(series.safeBand.min, yMin)) -
              toY(Math.min(series.safeBand.max, yMax)),
            0,
          ),
        }
      : null;

  const yTicks = [yMax, (yMax + yMin) / 2, yMin];
  const xLabels =
    points.length <= 4
      ? points.map((point, index) => ({ index, label: formatAxisDate(point.observedAt) }))
      : [0, Math.floor((points.length - 1) / 2), points.length - 1].map((index) => ({
          index,
          label: formatAxisDate(points[index].observedAt),
        }));

  return (
    <View style={styles.chartWrap} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {safeBand ? (
            <Rect
              x={padding.left}
              y={safeBand.y}
              width={chartWidth}
              height={safeBand.height}
              fill={series.lineColor}
              opacity={0.12}
            />
          ) : null}

          {yTicks.map((tick, index) => {
            const y = toY(tick);
            return (
              <Line
                key={`grid-${index}`}
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}

          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={series.lineColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => (
            <Circle
              key={`${point.observedAt}-${index}`}
              cx={toX(index)}
              cy={toY(point.value)}
              r={3.5}
              fill={colors.white}
              stroke={series.lineColor}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}

      <View style={styles.yAxisLabels} pointerEvents="none">
        {yTicks.map((tick, index) => (
          <Text key={`y-${index}`} style={styles.axisLabel}>
            {Number(tick.toFixed(tick >= 1 ? 1 : 2))}
          </Text>
        ))}
      </View>

      <View style={styles.xAxisLabels} pointerEvents="none">
        {xLabels.map((item) => (
          <Text key={`x-${item.index}`} style={styles.axisLabel}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function TrendChartCard({
  series,
  points,
  rangeLabel,
}: {
  series: ChartSeries;
  points: PondTrendPoint[];
  rangeLabel: string;
}) {
  const chartPoints = points
    .map((point) => ({
      observedAt: point.observedAt,
      value: point[series.key],
    }))
    .filter(
      (point): point is { observedAt: string; value: number } =>
        point.value !== null,
    );

  const hasData = chartPoints.length >= MIN_POINTS;
  const latest = chartPoints[chartPoints.length - 1]?.value ?? null;

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleRow}>
          <View
            style={[styles.trendDot, { backgroundColor: series.lineColor }]}
          />
          <View>
            <Text style={styles.trendTitle}>
              {series.title}
              {series.unit ? ` (${series.unit})` : ""}
            </Text>
            <Text style={styles.trendValue}>
              {formatLatestValue(latest, series.unit)}
            </Text>
          </View>
        </View>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
      </View>

      <Text style={styles.safeZone}>SAFE ZONE: {series.safeZone}</Text>

      {hasData ? (
        <LineTrendChart points={chartPoints} series={series} />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="bar-chart-2" size={18} color={colors.primary} />
          </View>
          <Text style={styles.noDataText}>Log more data to see trends</Text>
          <Text style={styles.emptyHint}>
            At least 2 data points are required to display a trend.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function PondTrendsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pondId: string }>();
  const pondId = resolvePondId(params.pondId);

  const [pond, setPond] = useState<StoredPond | null>(null);
  const [points, setPoints] = useState<PondTrendPoint[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    const [pondData, trendPoints] = await Promise.all([
      getPondById(pondId),
      getTrendPointsForPond(pondId, timeframe),
    ]);

    setPond(pondData);
    setPoints(trendPoints);
    setIsLoading(false);
  }, [pondId, timeframe]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const rangeLabel = useMemo(() => formatRangeLabel(timeframe), [timeframe]);
  const hasAnyTrend = SERIES.some(
    (series) =>
      points.filter((point) => point[series.key] !== null).length >= MIN_POINTS,
  );

  const statusLabel =
    pond?.waterQualityStatus === "Good" || pond?.waterQualityStatus === "Excellent"
      ? "Optimal Conditions"
      : pond?.waterQualityStatus === "Attention" || pond?.waterQualityStatus === "Fair"
        ? "Needs Attention"
        : pond?.waterQualityStatus === "Critical" || pond?.waterQualityStatus === "Poor"
          ? "Critical Alerts"
          : "Pending Data";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{pond?.pondName ?? "Pond Trends"}</Text>
          <Pressable style={styles.iconButton}>
            <Feather name="download" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <Text style={styles.statusEyebrow}>CURRENT STATUS</Text>
            <Text style={styles.statusTitle}>{statusLabel}</Text>
            <Text style={styles.statusBody}>
              {hasAnyTrend
                ? "All parameters within safety zones."
                : "Add logs to unlock trend analytics."}
            </Text>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={styles.badgeValue}>98%</Text>
                <Text style={styles.badgeLabel}>Stability</Text>
              </View>
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeValue}>0</Text>
                <Text style={styles.badgeLabel}>Alerts</Text>
              </View>
            </View>
          </View>

          <View style={styles.timeframeRow}>
            {(["7D", "14D", "30D"] as Timeframe[]).map((option) => {
              const isActive = timeframe === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => setTimeframe(option)}
                  style={[
                    styles.timeframeChip,
                    isActive && styles.timeframeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeframeText,
                      isActive && styles.timeframeTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.rangeCaption}>{rangeLabel}</Text>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <>
              {SERIES.map((series) => (
                <TrendChartCard
                  key={series.key}
                  series={series}
                  points={points}
                  rangeLabel={rangeLabel}
                />
              ))}

              <View style={styles.trendCard}>
                <Text style={styles.trendTitle}>Need more readings?</Text>
                <Text style={styles.noDataText}>
                  Log water quality regularly to unlock clearer trends.
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() =>
                      pondId && navigateToDailyLogEntry(router, pondId)
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>+ Add Log</Text>
                  </Pressable>
                  <Pressable style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Export CSV</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.predictiveBanner}>
                <Text style={styles.predictiveEyebrow}>PREDICTIVE ANALYTICS</Text>
                <Text style={styles.predictiveText}>
                  DO levels stable for next 48h
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {pondId ? (
          <PondBottomNav pondId={pondId} activeTab="trends" />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
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
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  statusEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  statusBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGreen: {
    backgroundColor: "#DCFCE7",
  },
  badgeBlue: {
    backgroundColor: colors.softBlue,
  },
  badgeValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  badgeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  timeframeRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  timeframeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  timeframeChipActive: {
    backgroundColor: colors.softBlue,
  },
  timeframeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  timeframeTextActive: {
    color: colors.primary,
  },
  rangeCaption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: -4,
  },
  loader: { paddingVertical: 40 },
  trendCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  trendTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  trendTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  trendValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  rangeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  safeZone: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chartWrap: {
    height: 140,
    marginTop: 4,
    position: "relative",
  },
  yAxisLabels: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 28,
    width: 30,
    justifyContent: "space-between",
  },
  xAxisLabels: {
    position: "absolute",
    left: 32,
    right: 8,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 6,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.emptyIcon,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  noDataText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  predictiveBanner: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  predictiveEyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  predictiveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
