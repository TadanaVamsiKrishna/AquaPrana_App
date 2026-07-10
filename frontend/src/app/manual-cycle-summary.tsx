import { useState } from "react";
import {
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllSpecies } from "../constants/crop-species";
import { formatDisplayDate, calculateHarvestWindow } from "../lib/harvest-window";
import { getOverallWaterQuality } from "../lib/water-quality";
import {
  clearPondDraft,
  formatLastLogTime,
  getPondDraft,
  savePond,
} from "../services/local-ponds";

const colors = {
  primary: "#0A84FF",
  background: "#F4FAFF",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6E4F0",
  softBlue: "#EAF5FF",
  paleBlue: "#F8FCFF",
  error: "#DC2626",
  disabled: "#B8D8F6",
  shadow: "#0A4F9E",
};

const speciesOptions = getAllSpecies();

type TouchedFields = {
  species: boolean;
  stockingDensity: boolean;
  currentCycleDay: boolean;
  totalFeed: boolean;
  totalMortality: boolean;
  currentAbw: boolean;
  ph: boolean;
  dissolvedOxygen: boolean;
  temperature: boolean;
  salinity: boolean;
  ammonia: boolean;
};

const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");

  if (parts.length <= 1) {
    return cleanedValue;
  }

  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, "");

const isPositiveNumber = (value: string) => {
  const numberValue = Number(value);
  return value.trim().length > 0 && Number.isFinite(numberValue) && numberValue > 0;
};

const isNonNegativeNumber = (value: string) => {
  const numberValue = Number(value);
  return (
    value.trim().length > 0 && Number.isFinite(numberValue) && numberValue >= 0
  );
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

export default function ManualCycleSummaryScreen() {
  const router = useRouter();

  const [species, setSpecies] = useState("");
  const [stockingDate, setStockingDate] = useState(() => new Date());
  const [stockingDensity, setStockingDensity] = useState("");
  const [currentCycleDay, setCurrentCycleDay] = useState("");
  const [totalFeed, setTotalFeed] = useState("");
  const [totalMortality, setTotalMortality] = useState("");
  const [currentAbw, setCurrentAbw] = useState("");
  const [ph, setPh] = useState("");
  const [dissolvedOxygen, setDissolvedOxygen] = useState("");
  const [temperature, setTemperature] = useState("");
  const [salinity, setSalinity] = useState("");
  const [ammonia, setAmmonia] = useState("");
  const [notes, setNotes] = useState("");
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const [showStockingDatePicker, setShowStockingDatePicker] = useState(false);
  const [touched, setTouched] = useState<TouchedFields>({
    species: false,
    stockingDensity: false,
    currentCycleDay: false,
    totalFeed: false,
    totalMortality: false,
    currentAbw: false,
    ph: false,
    dissolvedOxygen: false,
    temperature: false,
    salinity: false,
    ammonia: false,
  });

  const speciesError = touched.species && !species ? "Species is required" : "";
  const stockingDensityError =
    touched.stockingDensity && !isPositiveNumber(stockingDensity)
      ? "Enter a valid stocking density/count"
      : "";
  const currentCycleDayError =
    touched.currentCycleDay && !isPositiveNumber(currentCycleDay)
      ? "Enter a valid current cycle day"
      : "";
  const totalFeedError =
    touched.totalFeed && !isPositiveNumber(totalFeed)
      ? "Enter total feed used till now"
      : "";
  const totalMortalityError =
    touched.totalMortality && !isNonNegativeNumber(totalMortality)
      ? "Enter total mortality till now"
      : "";
  const currentAbwError =
    touched.currentAbw && !isPositiveNumber(currentAbw)
      ? "Enter average body weight"
      : "";
  const phError =
    touched.ph && !isPositiveNumber(ph) ? "Enter a valid pH value" : "";
  const dissolvedOxygenError =
    touched.dissolvedOxygen && !isPositiveNumber(dissolvedOxygen)
      ? "Enter a valid DO value"
      : "";
  const temperatureError =
    touched.temperature && !isPositiveNumber(temperature)
      ? "Enter a valid temperature"
      : "";
  const salinityError =
    touched.salinity && !isNonNegativeNumber(salinity)
      ? "Enter a valid salinity value"
      : "";
  const ammoniaError =
    touched.ammonia && !isNonNegativeNumber(ammonia)
      ? "Enter a valid ammonia value"
      : "";

  const isFormValid =
    species.trim().length > 0 &&
    isPositiveNumber(stockingDensity) &&
    isPositiveNumber(currentCycleDay) &&
    isPositiveNumber(totalFeed) &&
    isNonNegativeNumber(totalMortality) &&
    isPositiveNumber(currentAbw) &&
    isPositiveNumber(ph) &&
    isPositiveNumber(dissolvedOxygen) &&
    isPositiveNumber(temperature) &&
    isNonNegativeNumber(salinity) &&
    isNonNegativeNumber(ammonia);

  const markTouched = (field: keyof TouchedFields) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const markAllTouched = () => {
    setTouched({
      species: true,
      stockingDensity: true,
      currentCycleDay: true,
      totalFeed: true,
      totalMortality: true,
      currentAbw: true,
      ph: true,
      dissolvedOxygen: true,
      temperature: true,
      salinity: true,
      ammonia: true,
    });
  };

  const handleSpeciesSelect = (value: string) => {
    setSpecies(value);
    setSpeciesPickerOpen(false);
  };

  const handleSaveSummary = async () => {
    if (!isFormValid) {
      markAllTouched();
      return;
    }

    const draft = await getPondDraft();
    const stockingCount = Number(stockingDensity);
    const mortalityCount = Number(totalMortality);
    const survivedCount = Math.max(stockingCount - mortalityCount, 0);
    const survivalRate =
      stockingCount > 0
        ? `${((survivedCount / stockingCount) * 100).toFixed(1)}%`
        : "—";
    const biomassKg = ((survivedCount * Number(currentAbw)) / 1000).toFixed(1);

    const harvestWindow = calculateHarvestWindow(stockingDate, species);
    const harvestWindowStart = harvestWindow
      ? formatDisplayDate(harvestWindow.earliest)
      : "—";
    const harvestWindowEnd = harvestWindow
      ? formatDisplayDate(harvestWindow.latest)
      : "—";

    await savePond({
      id: draft?.id ?? Date.now().toString(),
      pondName: draft?.pondName?.trim() || "",
      name: draft?.pondName?.trim() || "",
      area: draft?.area ?? "",
      depth: draft?.depth ?? "",
      species,
      stockingDate: formatDisplayDate(stockingDate),
      stockingDensity,
      harvestWindowStart,
      harvestWindowEnd,
      cycleDay: currentCycleDay,
      biomass: `${biomassKg} kg`,
      survivalRate,
      waterQualityStatus: getOverallWaterQuality({
        do: Number(dissolvedOxygen),
        ph: Number(ph),
        ammonia: Number(ammonia),
      }),
      lastLogTime: formatLastLogTime(new Date()),
      latestReadings: {
        dissolvedOxygen,
        ph,
        temperature: "",
        salinity: "",
        ammonia,
        calcium: "",
        magnesium: "",
        potassium: "",
      },
      isActive: true,
      archived: false,
    });

    await clearPondDraft();
    router.replace("/home" as never);
  };

  const renderNumericField = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    field: keyof TouchedFields,
    error: string,
    options?: {
      integer?: boolean;
      suffix?: string;
      placeholder?: string;
    },
  ) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.numericInputShell, error ? styles.inputError : null]}>
        <TextInput
          value={value}
          onChangeText={(text) =>
            onChangeText(
              options?.integer
                ? sanitizeIntegerInput(text)
                : sanitizeDecimalInput(text),
            )
          }
          onBlur={() => markTouched(field)}
          placeholder={options?.placeholder ?? "0"}
          placeholderTextColor={colors.muted}
          style={styles.numericInput}
          keyboardType={options?.integer ? "number-pad" : "decimal-pad"}
          inputMode={options?.integer ? "numeric" : "decimal"}
          returnKeyType="done"
        />
        {options?.suffix ? (
          <Text style={styles.suffix}>{options.suffix}</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color={colors.primary} />
            </Pressable>

            <Text style={styles.headerTitle}>Cycle Summary</Text>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Cycle summary",
                  "Enter your existing cycle details to continue tracking in AquaPrana.",
                )
              }
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <Feather name="help-circle" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!speciesPickerOpen}
            nestedScrollEnabled
          >
            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Species</Text>

                <Pressable
                  onPress={() => setSpeciesPickerOpen((current) => !current)}
                  style={[
                    styles.selectControl,
                    speciesPickerOpen && styles.selectControlActive,
                    speciesError ? styles.inputError : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !species && styles.placeholderText,
                    ]}
                  >
                    {species || "Select Species"}
                  </Text>

                  <Feather
                    name={speciesPickerOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={speciesPickerOpen ? colors.primary : colors.muted}
                  />
                </Pressable>

                {speciesPickerOpen ? (
                  <View style={styles.dropdownMenu}>
                    <FlatList
                      data={speciesOptions}
                      keyExtractor={(option) => option}
                      style={styles.dropdownScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                      persistentScrollbar={Platform.OS === "android"}
                      renderItem={({ item: option, index }) => {
                        const isSelected = species === option;
                        const isLastOption = index === speciesOptions.length - 1;

                        return (
                          <Pressable
                            onPress={() => handleSpeciesSelect(option)}
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
                              <Feather
                                name="check"
                                size={18}
                                color={colors.primary}
                              />
                            ) : null}
                          </Pressable>
                        );
                      }}
                    />
                  </View>
                ) : null}

                {speciesError ? (
                  <Text style={styles.errorText}>{speciesError}</Text>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Stocking Date</Text>

                <Pressable
                  onPress={() => setShowStockingDatePicker(true)}
                  style={styles.dateControl}
                  accessibilityRole="button"
                  accessibilityLabel="Select stocking date"
                >
                  <Text style={styles.dateText}>
                    {formatDisplayDate(stockingDate)}
                  </Text>
                  <Feather name="calendar" size={20} color={colors.primary} />
                </Pressable>
              </View>

              {renderNumericField(
                "Stocking Density / Count",
                stockingDensity,
                setStockingDensity,
                "stockingDensity",
                stockingDensityError,
                { placeholder: "e.g. 50", suffix: "PL/m²" },
              )}

              {renderNumericField(
                "Current Cycle Day",
                currentCycleDay,
                setCurrentCycleDay,
                "currentCycleDay",
                currentCycleDayError,
                { integer: true, placeholder: "e.g. 45", suffix: "Days" },
              )}

              {renderNumericField(
                "Total Feed Used Till Now",
                totalFeed,
                setTotalFeed,
                "totalFeed",
                totalFeedError,
                { placeholder: "e.g. 1200", suffix: "kg" },
              )}

              {renderNumericField(
                "Total Mortality Till Now",
                totalMortality,
                setTotalMortality,
                "totalMortality",
                totalMortalityError,
                { placeholder: "e.g. 25", suffix: "count" },
              )}

              {renderNumericField(
                "Average Body Weight / Current ABW",
                currentAbw,
                setCurrentAbw,
                "currentAbw",
                currentAbwError,
                { placeholder: "e.g. 12.5", suffix: "g" },
              )}

              <Text style={styles.groupTitle}>
                Last Recorded Water Quality Values
              </Text>

              {renderNumericField("pH", ph, setPh, "ph", phError, {
                placeholder: "e.g. 7.8",
              })}

              {renderNumericField(
                "DO (Dissolved Oxygen)",
                dissolvedOxygen,
                setDissolvedOxygen,
                "dissolvedOxygen",
                dissolvedOxygenError,
                { placeholder: "e.g. 5.2", suffix: "mg/L" },
              )}

              {renderNumericField(
                "Temperature",
                temperature,
                setTemperature,
                "temperature",
                temperatureError,
                { placeholder: "e.g. 28", suffix: "°C" },
              )}

              {renderNumericField(
                "Salinity",
                salinity,
                setSalinity,
                "salinity",
                salinityError,
                { placeholder: "e.g. 15", suffix: "ppt" },
              )}

              {renderNumericField(
                "Ammonia",
                ammonia,
                setAmmonia,
                "ammonia",
                ammoniaError,
                { placeholder: "e.g. 0.1", suffix: "mg/L" },
              )}

              <View style={styles.fieldBlockLast}>
                <Text style={styles.label}>Notes / Remarks (Optional)</Text>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any additional remarks"
                  placeholderTextColor={colors.muted}
                  style={styles.notesInput}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSaveSummary}
              disabled={!isFormValid}
              style={({ pressed }) => [
                styles.saveButton,
                !isFormValid && styles.saveButtonDisabled,
                pressed && isFormValid && styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isFormValid }}
            >
              <Text style={styles.saveButtonText}>Save Summary</Text>
              <View style={styles.saveButtonIcon}>
                <Feather name="check" size={16} color={colors.white} />
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {showStockingDatePicker ? (
        <DateTimePicker
          value={stockingDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) =>
            handleDatePickerChange(
              event,
              selectedDate,
              setStockingDate,
              () => setShowStockingDatePicker(false),
            )
          }
        />
      ) : null}
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
  header: {
    height: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  iconButtonPressed: {
    opacity: 0.82,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  fieldBlockLast: {
    marginBottom: 0,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    marginBottom: 14,
    marginTop: 4,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  selectControl: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectControlActive: {
    borderColor: colors.primary,
  },
  selectText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  placeholderText: {
    color: colors.muted,
    fontWeight: "500",
  },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownOption: {
    minHeight: 50,
    paddingHorizontal: 16,
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
    opacity: 0.85,
  },
  dropdownOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },
  dateControl: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  numericInputShell: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  numericInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    padding: 0,
  },
  suffix: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  notesInput: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: colors.background,
  },
  saveButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 7,
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
  },
  saveButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
