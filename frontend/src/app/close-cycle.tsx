import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import {
  closeCropCycle,
  formatCycleFcr,
  formatCycleSurvival,
  getActiveCropCycleForPond,
  type CropCycleRecord,
} from "../services/cropCycle";
import { getSupabasePondById } from "../services/pond";
import { savePondDraft } from "../services/local-ponds";
import { generateCycleReport } from "../services/reportService";

type CycleOutcome = "Successful" | "Failed";

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
  error: "#DC2626",
  errorSoft: "#FEF2F2",
};

const OUTCOME_OPTIONS: CycleOutcome[] = ["Successful", "Failed"];

const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");

  if (parts.length <= 1) {
    return cleanedValue;
  }

  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const handleDatePickerChange = (
  event: DateTimePickerEvent,
  selectedDate: Date | undefined,
  onSelect: (date: Date) => void,
  onClose: () => void,
) => {
  if (Platform.OS === "android") {
    onClose();
  }

  if (event.type === "dismissed") {
    if (Platform.OS === "ios") {
      onClose();
    }
    return;
  }

  if (event.type === "set" && selectedDate) {
    onSelect(selectedDate);
    if (Platform.OS === "ios") {
      onClose();
    }
  }
};

function formatInputDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatWebInputDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function parseWebInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export default function CloseCycleScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [activeCycle, setActiveCycle] = useState<CropCycleRecord | null>(null);
  const [pondName, setPondName] = useState("My Pond");
  const [pondArea, setPondArea] = useState("");
  const [pondDepth, setPondDepth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CycleOutcome>("Successful");
  const [outcomePickerOpen, setOutcomePickerOpen] = useState(false);
  const [harvestDate, setHarvestDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [harvestWeight, setHarvestWeight] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const webDateInputRef = useRef<TextInput>(null);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [pondData, cycle] = await Promise.all([
        getSupabasePondById(pondId),
        getActiveCropCycleForPond(pondId),
      ]);

      setPondName(pondData?.name?.trim() || "My Pond");
      setPondArea(String(pondData?.area_acres ?? ""));
      setPondDepth(String(pondData?.depth_ft ?? ""));
      setActiveCycle(cycle);

      if (!cycle) {
        setLoadError("No active crop cycle found for this pond.");
      }
    } catch (error) {
      console.log("[close-cycle] load error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load active cycle.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const finalFcr = useMemo(
    () => formatCycleFcr(activeCycle?.estimated_fcr),
    [activeCycle],
  );

  const finalSurvival = useMemo(
    () => formatCycleSurvival(activeCycle?.survival_rate),
    [activeCycle],
  );

  const isFailed = outcome === "Failed";

  const handleHarvestDatePress = () => {
    if (Platform.OS === "web") {
      const input = webDateInputRef.current as
        | (TextInput & {
            showPicker?: () => void;
            click?: () => void;
            getNativeRef?: () => HTMLInputElement | null;
          })
        | null;
      const nativeInput = input?.getNativeRef?.() ?? (input as unknown as HTMLInputElement | null);

      if (nativeInput && typeof nativeInput.showPicker === "function") {
        nativeInput.showPicker();
        return;
      }

      nativeInput?.click?.();
      return;
    }

    setShowDatePicker(true);
  };

  const handleWebDateChange = (value: string) => {
    const parsedDate = parseWebInputDate(value);

    if (parsedDate) {
      setHarvestDate(parsedDate);
    }
  };

  const isFormValid =
    harvestWeight.trim().length > 0 &&
    Number(harvestWeight) > 0 &&
    (!isFailed || failureReason.trim().length > 0);

  const closeCycle = async (startNew: boolean) => {
    if (!activeCycle || !pondId || !isFormValid || isSubmitting) {
      if (!activeCycle) {
        Alert.alert(
          "No active cycle",
          loadError ?? "There is no active crop cycle to close.",
        );
      } else if (!isFormValid) {
        Alert.alert(
          "Missing details",
          isFailed
            ? "Enter harvest weight and failure reason before closing the cycle."
            : "Enter harvest weight before closing the cycle.",
        );
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await closeCropCycle(activeCycle.id, {
        outcome,
        actualHarvestDate: harvestDate,
        harvestWeightKg: Number(harvestWeight),
        notes: isFailed ? failureReason.trim() : undefined,
      });

      const closedCycleId = activeCycle.id;

      if (startNew) {
        void generateCycleReport(closedCycleId).catch((error) => {
          console.log("[close-cycle] report generation error:", error);
        });

        await savePondDraft({
          id: pondId,
          pondName,
          area: pondArea,
          depth: pondDepth,
        });

        router.replace("/start-journey" as never);
        return;
      }

      router.replace({
        pathname: "/cycle-report",
        params: { pondId, cycleId: closedCycleId },
      } as never);
    } catch (error) {
      console.log("[close-cycle] save error:", error);
      Alert.alert(
        "Unable to close cycle",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
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

  if (loadError && !activeCycle) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loaderScreen}>
          <Text style={styles.errorTitle}>No Active Crop Cycle</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Close Cycle</Text>
            <View style={styles.headerBadge}>
              <Feather name="droplet" size={14} color={colors.primary} />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!outcomePickerOpen}
            nestedScrollEnabled
          >
            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Cycle Outcome</Text>
                <Pressable
                  onPress={() => setOutcomePickerOpen((current) => !current)}
                  style={[
                    styles.selectControl,
                    outcomePickerOpen && styles.selectControlActive,
                  ]}
                >
                  <Text style={styles.selectText}>{outcome}</Text>
                  <Feather
                    name={outcomePickerOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={outcomePickerOpen ? colors.primary : colors.muted}
                  />
                </Pressable>

                {outcomePickerOpen ? (
                  <View style={styles.dropdownMenu}>
                    <FlatList
                      data={OUTCOME_OPTIONS}
                      keyExtractor={(option) => option}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item: option, index }) => {
                        const isSelected = outcome === option;
                        const isLastOption = index === OUTCOME_OPTIONS.length - 1;

                        return (
                          <Pressable
                            onPress={() => {
                              setOutcome(option);
                              setOutcomePickerOpen(false);
                              if (option === "Successful") {
                                setFailureReason("");
                              }
                            }}
                            style={({ pressed }) => [
                              styles.dropdownOption,
                              isSelected && styles.dropdownOptionSelected,
                              isLastOption && styles.dropdownOptionLast,
                              pressed && styles.dropdownOptionPressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dropdownOptionText,
                                isSelected && styles.dropdownOptionTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                            {isSelected ? (
                              <Feather name="check" size={18} color={colors.primary} />
                            ) : null}
                          </Pressable>
                        );
                      }}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Actual Harvest Date</Text>
                <Pressable
                  onPress={handleHarvestDatePress}
                  style={styles.dateControl}
                >
                  <Text style={styles.dateText}>{formatInputDate(harvestDate)}</Text>
                  <Feather name="calendar" size={20} color={colors.primary} />
                  {Platform.OS === "web" ? (
                    <TextInput
                      ref={webDateInputRef}
                      value={formatWebInputDate(harvestDate)}
                      onChangeText={handleWebDateChange}
                      style={styles.hiddenWebDateInput}
                      // @ts-expect-error web-only input type
                      type="date"
                    />
                  ) : null}
                </Pressable>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Harvest Weight (kg)</Text>
                <View style={styles.numericInputShell}>
                  <TextInput
                    value={harvestWeight}
                    onChangeText={(value) =>
                      setHarvestWeight(sanitizeDecimalInput(value))
                    }
                    placeholder="e.g. 1250"
                    placeholderTextColor={colors.muted}
                    style={styles.numericInput}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    returnKeyType="done"
                  />
                  <Feather name="activity" size={18} color={colors.muted} />
                </View>
              </View>

              {isFailed ? (
                <View style={styles.fieldBlock}>
                  <Text style={[styles.label, styles.failureLabel]}>
                    Failure Reason
                  </Text>
                  <TextInput
                    value={failureReason}
                    onChangeText={setFailureReason}
                    placeholder="Enter reason for failure (e.g., disease, oxygen drop, equipment failure)"
                    placeholderTextColor={colors.muted}
                    style={styles.failureInput}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Final Performance Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Final FCR</Text>
                  <Text style={styles.summaryValue}>{finalFcr}</Text>
                  <Text style={styles.summaryHint}>ratio</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Final Survival Rate</Text>
                  <Text style={[styles.summaryValue, styles.summaryValueGreen]}>
                    {finalSurvival}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Closing this cycle will{" "}
                <Text style={styles.infoTextBold}>lock all logs for editing</Text>
                . Ensure all feed, water quality, and mortality records are
                accurate before proceeding.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => closeCycle(true)}
              disabled={!isFormValid || isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isFormValid || isSubmitting) && styles.primaryButtonDisabled,
                pressed && isFormValid && styles.pressed,
              ]}
            >
              <Feather name="refresh-cw" size={16} color={colors.white} />
              <Text style={styles.primaryButtonText}>Close Cycle & Start New</Text>
            </Pressable>

            <Pressable
              onPress={() => closeCycle(false)}
              disabled={!isFormValid || isSubmitting}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text
                style={[
                  styles.secondaryLink,
                  (!isFormValid || isSubmitting) && styles.secondaryLinkDisabled,
                ]}
              >
                Close Cycle Only
              </Text>
            </Pressable>
          </View>

          {pondId ? (
            <PondBottomNav pondId={pondId} activeTab="cycles" />
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS !== "web" ? (
        <DateTimePicker
          value={harvestDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) =>
            handleDatePickerChange(
              event,
              selectedDate,
              setHarvestDate,
              () => setShowDatePicker(false),
            )
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  loaderScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontWeight: "500",
  },
  backLink: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
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
  headerBadge: {
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
    gap: 14,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  fieldBlock: { gap: 8 },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  failureLabel: {
    color: colors.error,
  },
  selectControl: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectControlActive: {
    borderColor: colors.primary,
  },
  selectText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  dropdownOption: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.softBlue,
  },
  dropdownOptionPressed: {
    opacity: 0.82,
  },
  dropdownOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },
  dateControl: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  dateText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  hiddenWebDateInput: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 44,
    opacity: 0,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  numericInputShell: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  numericInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    padding: 0,
  },
  failureInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  summaryValueGreen: {
    color: colors.success,
  },
  summaryHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: colors.softBlue,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  infoTextBold: {
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: colors.background,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#B8D8F6",
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryLink: {
    textAlign: "center",
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    paddingVertical: 4,
  },
  secondaryLinkDisabled: {
    color: colors.muted,
  },
  pressed: {
    opacity: 0.82,
  },
});
