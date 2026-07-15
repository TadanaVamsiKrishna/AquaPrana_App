import { StyleSheet, Text, View } from "react-native";

const colors = {
  text: "#0F172A",
  muted: "#64748B",
  white: "#FFFFFF",
};

function DonutSlice({
  color,
  size,
  thickness,
  startDeg,
  sweepDeg,
}: {
  color: string;
  size: number;
  thickness: number;
  startDeg: number;
  sweepDeg: number;
}) {
  if (sweepDeg <= 0) {
    return null;
  }

  const half = size / 2;
  const clamped = Math.min(sweepDeg, 179.9);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.donutSlice,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${startDeg}deg` }],
        },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: thickness,
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: clamped > 90 ? color : "transparent",
          transform: [{ rotate: `${Math.max(clamped - 90, 0)}deg` }],
        }}
      />
    </View>
  );
}

export type ExpenseChartSegment = {
  label: string;
  value: number;
  color: string;
  start: number;
  sweep: number;
  percent: number;
};

export const buildExpenseChartSegments = (
  items: { label: string; value: number; color: string }[],
): ExpenseChartSegment[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return items.map((item) => ({
      ...item,
      start: 0,
      sweep: 0,
      percent: 0,
    }));
  }

  let cursor = 0;

  return items.map((item) => {
    const sweep = (item.value / total) * 360;
    const segment = {
      ...item,
      start: cursor,
      sweep,
      percent: Math.round((item.value / total) * 100),
    };
    cursor += sweep;
    return segment;
  });
};

export function ExpenseDonutChart({
  totalLabel,
  centerValue,
  segments,
}: {
  totalLabel: string;
  centerValue: string;
  segments: ExpenseChartSegment[];
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.outer}>
        {segments.map((segment) => (
          <DonutSlice
            key={segment.label}
            color={segment.color}
            size={168}
            thickness={22}
            startDeg={segment.start}
            sweepDeg={segment.sweep}
          />
        ))}
        <View style={styles.hole}>
          <Text style={styles.holeLabel}>{totalLabel}</Text>
          <Text style={styles.holeValue}>{centerValue}</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={styles.legendText}>{segment.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 16,
  },
  outer: {
    width: 168,
    height: 168,
    alignItems: "center",
    justifyContent: "center",
  },
  donutSlice: {
    position: "absolute",
  },
  hole: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  holeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  holeValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
});
