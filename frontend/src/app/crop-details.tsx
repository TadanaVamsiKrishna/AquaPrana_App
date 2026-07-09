import { useMemo, useState } from "react";
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
import {
  getCategoryLabels,
  getSpeciesForCategory,
  isCustomSpecies,
} from "../constants/crop-species";
import {
  formatDisplayDate,
  getHarvestWindowDisplay,
  calculateHarvestWindow,
} from "../lib/harvest-window";
import {
  calculateCycleDay,
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
  disabled: "#B8D8F6",
  shadow: "#0A4F9E",
};

type PickerField = "category" | "species";
type HarvestDateField = "earliest" | "latest";

const categoryOptions = getCategoryLabels();

const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, "");

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

export default function CropDetailsScreen() {
  const router = useRouter();

  const [category, setCategory] = useState("");
  const [species, setSpecies] = useState("");
  const [stockingDensity, setStockingDensity] = useState("");
  const [stockingDate, setStockingDate] = useState(() => new Date());
  const [seedSupplier, setSeedSupplier] = useState("");
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const [showStockingDatePicker, setShowStockingDatePicker] = useState(false);
  const [manualHarvestEarliest, setManualHarvestEarliest] = useState<Date | null>(
    null,
  );
  const [manualHarvestLatest, setManualHarvestLatest] = useState<Date | null>(
    null,
  );
  const [activeHarvestDatePicker, setActiveHarvestDatePicker] =
    useState<HarvestDateField | null>(null);

  const speciesOptions = category ? getSpeciesForCategory(category) : [];

  const harvestDisplay = useMemo(
    () =>
      getHarvestWindowDisplay({
        species,
        stockingDate,
        manualEarliest: manualHarvestEarliest,
        manualLatest: manualHarvestLatest,
      }),
    [species, stockingDate, manualHarvestEarliest, manualHarvestLatest],
  );

  const hasRequiredHarvestWindow =
    harvestDisplay.mode === "calculated" ||
    (harvestDisplay.mode === "manual" &&
      manualHarvestEarliest !== null &&
      manualHarvestLatest !== null);

  const isFormValid =
    category.trim().length > 0 &&
    species.trim().length > 0 &&
    stockingDensity.trim().length > 0 &&
    Number(stockingDensity) > 0 &&
    hasRequiredHarvestWindow;

  const openPicker = (field: PickerField) => {
    if (field === "species" && !category) {
      Alert.alert("Select Category", "Please choose a category first.");
      return;
    }

    setActivePicker((current) => (current === field ? null : field));
  };

  const handleCategorySelect = (value: string) => {
    setCategory(value);
    setSpecies("");
    setManualHarvestEarliest(null);
    setManualHarvestLatest(null);
    setActivePicker(null);
  };

  const handleSpeciesSelect = (value: string) => {
    setSpecies(value);
    setManualHarvestEarliest(null);
    setManualHarvestLatest(null);
    setActivePicker(null);
  };

  const handleStockingDatePress = () => {
    setShowStockingDatePicker(true);
  };

  const handleHarvestDatePress = (field: HarvestDateField) => {
    if (!isCustomSpecies(species)) {
      return;
    }

    setActiveHarvestDatePicker(field);
  };

  const handleSave = async () => {
    if (!isFormValid) {
      return;
    }

    const draft = await getPondDraft();
    let harvestWindowStart = "";
    let harvestWindowEnd = "";

    if (harvestDisplay.mode === "calculated") {
      harvestWindowStart = harvestDisplay.earliest;
      harvestWindowEnd = harvestDisplay.latest;
    } else if (
      harvestDisplay.mode === "manual" &&
      manualHarvestEarliest &&
      manualHarvestLatest
    ) {
      harvestWindowStart = formatDisplayDate(manualHarvestEarliest);
      harvestWindowEnd = formatDisplayDate(manualHarvestLatest);
    } else {
      const harvestWindow = calculateHarvestWindow(stockingDate, species);
      if (harvestWindow) {
        harvestWindowStart = formatDisplayDate(harvestWindow.earliest);
        harvestWindowEnd = formatDisplayDate(harvestWindow.latest);
      }
    }

    await savePond({
      id: Date.now().toString(),
      pondName: draft?.pondName ?? "My Pond",
      area: draft?.area ?? "",
      depth: draft?.depth ?? "",
      species,
      stockingDate: formatDisplayDate(stockingDate),
      stockingDensity,
      harvestWindowStart,
      harvestWindowEnd,
      cycleDay: String(calculateCycleDay(stockingDate)),
      biomass: "—",
      survivalRate: "100%",
      waterQualityStatus: "Not logged",
      lastLogTime: "—",
    });

    await clearPondDraft();
    router.replace("/home" as never);
  };

  const renderHarvestValue = (
    value: string | null | undefined,
    fallback: string,
  ) => {
    if (value) {
      return <Text style={styles.harvestDateValue}>{value}</Text>;
    }

    return (
      <Text style={[styles.harvestDateValue, styles.harvestDatePlaceholder]}>
        {fallback}
      </Text>
    );
  };

  const renderDropdown = (
    field: PickerField,
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) => {
    if (activePicker !== field) {
      return null;
    }

    return (
      <View style={styles.dropdownMenu}>
        <FlatList
          data={options}
          keyExtractor={(option) => option}
          style={styles.dropdownScroll}
          contentContainerStyle={styles.dropdownScrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          persistentScrollbar={Platform.OS === "android"}
          renderItem={({ item: option, index }) => {
            const isSelected = selectedValue === option;
            const isLastOption = index === options.length - 1;

            return (
              <Pressable
                onPress={() => onSelect(option)}
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
    );
  };

  const harvestSubtitle =
    harvestDisplay.mode === "manual"
      ? harvestDisplay.message
      : "Based on standard growth cycles for selected species";

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

            <Text style={styles.headerTitle}>Crop Details</Text>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Crop details",
                  "Enter crop and stocking information to start your aquaculture cycle.",
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
            scrollEnabled={!activePicker}
            nestedScrollEnabled
          >
            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Category</Text>

                <Pressable
                  onPress={() => openPicker("category")}
                  style={[
                    styles.selectControl,
                    activePicker === "category" && styles.selectControlActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !category && styles.placeholderText,
                    ]}
                  >
                    {category || "Select Category"}
                  </Text>

                  <Feather
                    name={
                      activePicker === "category" ? "chevron-up" : "chevron-down"
                    }
                    size={20}
                    color={
                      activePicker === "category" ? colors.primary : colors.muted
                    }
                  />
                </Pressable>

                {renderDropdown(
                  "category",
                  categoryOptions,
                  category,
                  handleCategorySelect,
                )}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Species</Text>

                <Pressable
                  onPress={() => openPicker("species")}
                  style={[
                    styles.selectControl,
                    activePicker === "species" && styles.selectControlActive,
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
                    name={
                      activePicker === "species" ? "chevron-up" : "chevron-down"
                    }
                    size={20}
                    color={
                      activePicker === "species" ? colors.primary : colors.muted
                    }
                  />
                </Pressable>

                {renderDropdown(
                  "species",
                  speciesOptions,
                  species,
                  handleSpeciesSelect,
                )}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Stocking Density</Text>

                <View style={styles.numericInputShell}>
                  <TextInput
                    value={stockingDensity}
                    onChangeText={(value) =>
                      setStockingDensity(sanitizeIntegerInput(value))
                    }
                    placeholder="e.g. 50"
                    placeholderTextColor={colors.muted}
                    style={styles.numericInput}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    returnKeyType="done"
                  />
                  <Text style={styles.suffix}>PL/m²</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Stocking Date</Text>

                <Pressable
                  onPress={handleStockingDatePress}
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

              <View style={styles.fieldBlockLast}>
                <Text style={styles.label}>Seed Supplier (Optional)</Text>

                <TextInput
                  value={seedSupplier}
                  onChangeText={setSeedSupplier}
                  placeholder="e.g., Hatchery Name"
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.harvestCard}>
              <View style={styles.harvestTopRow}>
                <View style={styles.harvestIconCircle}>
                  <Feather name="calendar" size={20} color={colors.primary} />
                </View>

                <View style={styles.harvestCopy}>
                  <Text style={styles.harvestTitle}>
                    Harvest Window (Auto-calculated)
                  </Text>
                  <Text style={styles.harvestSubtitle}>{harvestSubtitle}</Text>
                </View>
              </View>

              <View style={styles.harvestDatesCard}>
                <Pressable
                  onPress={() => handleHarvestDatePress("earliest")}
                  disabled={harvestDisplay.mode !== "manual"}
                  style={styles.harvestDateBlock}
                  accessibilityRole={
                    harvestDisplay.mode === "manual" ? "button" : "text"
                  }
                  accessibilityLabel="Earliest harvest date"
                >
                  <Text style={styles.harvestDateLabel}>EARLIEST</Text>
                  {harvestDisplay.mode === "manual" ? (
                    renderHarvestValue(
                      harvestDisplay.earliest,
                      "Select date",
                    )
                  ) : harvestDisplay.mode === "placeholder" ? (
                    renderHarvestValue(null, harvestDisplay.message)
                  ) : (
                    renderHarvestValue(harvestDisplay.earliest, "—")
                  )}
                </Pressable>

                <Feather
                  name="arrow-right"
                  size={18}
                  color={colors.primary}
                  style={styles.harvestArrow}
                />

                <Pressable
                  onPress={() => handleHarvestDatePress("latest")}
                  disabled={harvestDisplay.mode !== "manual"}
                  style={styles.harvestDateBlock}
                  accessibilityRole={
                    harvestDisplay.mode === "manual" ? "button" : "text"
                  }
                  accessibilityLabel="Latest harvest date"
                >
                  <Text style={styles.harvestDateLabel}>LATEST</Text>
                  {harvestDisplay.mode === "manual" ? (
                    renderHarvestValue(
                      harvestDisplay.latest,
                      "Select date",
                    )
                  ) : harvestDisplay.mode === "placeholder" ? (
                    renderHarvestValue(null, harvestDisplay.message)
                  ) : (
                    renderHarvestValue(harvestDisplay.latest, "—")
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.infoNote}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={styles.infoNoteText}>
                Accurate stocking density helps our AI predict harvest yields and
                feed requirements.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={!isFormValid}
              style={({ pressed }) => [
                styles.saveButton,
                !isFormValid && styles.saveButtonDisabled,
                pressed && isFormValid && styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isFormValid }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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

      {activeHarvestDatePicker === "earliest" ? (
        <DateTimePicker
          value={manualHarvestEarliest ?? stockingDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={stockingDate}
          onChange={(event, selectedDate) =>
            handleDatePickerChange(
              event,
              selectedDate,
              setManualHarvestEarliest,
              () => setActiveHarvestDatePicker(null),
            )
          }
        />
      ) : null}

      {activeHarvestDatePicker === "latest" ? (
        <DateTimePicker
          value={
            manualHarvestLatest ??
            manualHarvestEarliest ??
            stockingDate
          }
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={manualHarvestEarliest ?? stockingDate}
          onChange={(event, selectedDate) =>
            handleDatePickerChange(
              event,
              selectedDate,
              setManualHarvestLatest,
              () => setActiveHarvestDatePicker(null),
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
    marginBottom: 18,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  fieldBlockLast: {
    marginBottom: 0,
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
  dropdownScrollContent: {
    paddingRight: Platform.OS === "android" ? 4 : 0,
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
  textInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  harvestCard: {
    backgroundColor: colors.softBlue,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  harvestTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  harvestIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  harvestCopy: {
    flex: 1,
  },
  harvestTitle: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  harvestSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 3,
  },
  harvestDatesCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  harvestDateBlock: {
    flex: 1,
    alignItems: "center",
  },
  harvestDateLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  harvestDateValue: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  harvestDatePlaceholder: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  harvestArrow: {
    marginHorizontal: 8,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 2,
  },
  infoNoteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    fontStyle: "italic",
    marginLeft: 10,
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
