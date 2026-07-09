import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildFeedingTimes,
  getFeedScheduleForPond,
  saveFeedSchedule,
  type FeedCalculationRule,
} from "../services/local-feed-schedule";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
};

const CALCULATION_RULES: FeedCalculationRule[] = [
  "Fixed Quantity",
  "% Biomass",
];

const FEED_BRANDS = [
  "High Protein Pellets",
  "Premium Feed",
  "Grower Feed",
  "Starter Feed",
];

const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");
  if (parts.length <= 1) {
    return cleanedValue;
  }
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

export default function FeedManagementScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [feedsPerDay, setFeedsPerDay] = useState(4);
  const [feedingTimes, setFeedingTimes] = useState<string[]>(
    buildFeedingTimes(4),
  );
  const [initialQuantity, setInitialQuantity] = useState("0.00");
  const [calculationRule, setCalculationRule] =
    useState<FeedCalculationRule>("Fixed Quantity");
  const [feedBrand, setFeedBrand] = useState("");
  const [rulePickerOpen, setRulePickerOpen] = useState(false);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!pondId) {
      return;
    }

    const schedule = await getFeedScheduleForPond(pondId);

    if (!schedule) {
      return;
    }

    setFeedsPerDay(schedule.feedsPerDay);
    setFeedingTimes(schedule.feedingTimes);
    setInitialQuantity(schedule.initialQuantity);
    setCalculationRule(schedule.calculationRule);
    setFeedBrand(schedule.feedBrand);
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule]),
  );

  const updateFeedsPerDay = (next: number) => {
    const value = Math.min(Math.max(next, 1), 6);
    setFeedsPerDay(value);
    setFeedingTimes(buildFeedingTimes(value));
  };

  const updateFeedingTime = (index: number, value: string) => {
    setFeedingTimes((current) =>
      current.map((time, timeIndex) => (timeIndex === index ? value : time)),
    );
  };

  const handleSave = async () => {
    if (!pondId) {
      Alert.alert("Pond not found", "Please go back and try again.");
      return;
    }

    setIsSaving(true);

    await saveFeedSchedule({
      pondId,
      feedsPerDay,
      feedingTimes,
      initialQuantity,
      calculationRule,
      feedBrand,
    });

    setIsSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconButton}
              accessibilityRole="button"
            >
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.topBarTitle}>Feeding Schedule Setup</Text>
            <View style={styles.iconButton} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>FEED MANAGEMENT</Text>
              <Text style={styles.heroTitle}>Optimization Hub</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={styles.cardTitle}>Daily Frequency</Text>
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Number of feeds per day</Text>
                <View style={styles.stepperControls}>
                  <Pressable
                    onPress={() => updateFeedsPerDay(feedsPerDay - 1)}
                    style={styles.stepperButton}
                  >
                    <Feather name="minus" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.stepperValue}>{feedsPerDay}</Text>
                  <Pressable
                    onPress={() => updateFeedsPerDay(feedsPerDay + 1)}
                    style={styles.stepperButton}
                  >
                    <Feather name="plus" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="rotate-cw" size={16} color={colors.primary} />
                <Text style={styles.cardTitle}>Feeding Times</Text>
              </View>

              {feedingTimes.map((time, index) => (
                <View key={`feed-${index}`} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Feed #{index + 1}</Text>
                  <View style={styles.timeInputShell}>
                    <TextInput
                      value={time}
                      onChangeText={(value) => updateFeedingTime(index, value)}
                      style={styles.timeInput}
                      placeholder="06:00"
                      placeholderTextColor={colors.muted}
                    />
                    <Feather name="clock" size={16} color={colors.muted} />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Initial Feed Quantity</Text>
              <View style={styles.quantityShell}>
                <TextInput
                  value={initialQuantity}
                  onChangeText={(value) =>
                    setInitialQuantity(sanitizeDecimalInput(value))
                  }
                  style={styles.quantityInput}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.quantityUnit}>kg/day</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Calculation Rule</Text>
              <Pressable
                onPress={() => setRulePickerOpen(true)}
                style={styles.selectInput}
              >
                <Text style={styles.selectText}>{calculationRule}</Text>
                <Feather name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Default Feed Brand/Type</Text>
              <Pressable
                onPress={() => setBrandPickerOpen(true)}
                style={styles.selectInput}
              >
                <Text
                  style={[
                    styles.selectText,
                    !feedBrand && styles.selectPlaceholder,
                  ]}
                >
                  {feedBrand || "Select a feed profile (Optional)"}
                </Text>
                <Feather name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving..." : "Save Schedule →"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={rulePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRulePickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setRulePickerOpen(false)}
        >
          <View style={styles.modalCard}>
            {CALCULATION_RULES.map((rule) => (
              <Pressable
                key={rule}
                onPress={() => {
                  setCalculationRule(rule);
                  setRulePickerOpen(false);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>{rule}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={brandPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBrandPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBrandPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => {
                setFeedBrand("");
                setBrandPickerOpen(false);
              }}
              style={styles.modalOption}
            >
              <Text style={styles.modalOptionText}>None</Text>
            </Pressable>
            {FEED_BRANDS.map((brand) => (
              <Pressable
                key={brand}
                onPress={() => {
                  setFeedBrand(brand);
                  setBrandPickerOpen(false);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>{brand}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  heroCard: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 28,
    minHeight: 120,
    justifyContent: "flex-end",
    backgroundColor: colors.primaryDark,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  stepperRow: {
    gap: 12,
  },
  stepperLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    alignSelf: "flex-start",
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "center",
  },
  timeRow: {
    gap: 8,
  },
  timeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  timeInputShell: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  quantityShell: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  quantityUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  selectInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  selectPlaceholder: {
    color: colors.muted,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
