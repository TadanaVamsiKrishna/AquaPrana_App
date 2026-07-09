import { useState } from "react";
import {
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/bottom-nav";
import {
  inferCategory,
  INVENTORY_UNITS,
  saveInventoryItem,
  type InventoryUnit,
} from "../services/local-inventory";

const colors = {
  primary: "#0A84FF",
  background: "#F2F5F8",
  white: "#FFFFFF",
  text: "#0B3A6E",
  textDark: "#1F2937",
  muted: "#6B7280",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  error: "#DC2626",
  disabled: "#B8D8F6",
  shadow: "#0A4F9E",
};

type TouchedFields = {
  name: boolean;
  unit: boolean;
  currentStock: boolean;
  restockThreshold: boolean;
  restockQuantity: boolean;
};

const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");

  if (parts.length <= 1) {
    return cleanedValue;
  }

  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const isNonNegativeNumber = (value: string) => {
  const numberValue = Number(value);
  return (
    value.trim().length > 0 &&
    Number.isFinite(numberValue) &&
    numberValue >= 0
  );
};

const isPositiveNumber = (value: string) => {
  const numberValue = Number(value);
  return (
    value.trim().length > 0 && Number.isFinite(numberValue) && numberValue > 0
  );
};

export default function AddInventoryScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryUnit>("kg");
  const [currentStock, setCurrentStock] = useState("");
  const [restockThreshold, setRestockThreshold] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    unit: false,
    currentStock: false,
    restockThreshold: false,
    restockQuantity: false,
  });

  const nameError =
    touched.name && !name.trim() ? "Product name is required" : "";
  const currentStockError =
    touched.currentStock && !currentStock.trim()
      ? "Current stock is required"
      : touched.currentStock && !isNonNegativeNumber(currentStock)
        ? "Enter a valid quantity"
        : "";
  const restockThresholdError =
    touched.restockThreshold && !restockThreshold.trim()
      ? "Restock threshold is required"
      : touched.restockThreshold && !isNonNegativeNumber(restockThreshold)
        ? "Enter a valid threshold"
        : "";
  const restockQuantityError =
    touched.restockQuantity && !restockQuantity.trim()
      ? "Restock quantity is required"
      : touched.restockQuantity && !isPositiveNumber(restockQuantity)
        ? "Enter a quantity greater than 0"
        : "";

  const isFormValid =
    name.trim().length > 0 &&
    !!unit &&
    isNonNegativeNumber(currentStock) &&
    isNonNegativeNumber(restockThreshold) &&
    isPositiveNumber(restockQuantity);

  const markTouched = (field: keyof TouchedFields) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const markAllTouched = () => {
    setTouched({
      name: true,
      unit: true,
      currentStock: true,
      restockThreshold: true,
      restockQuantity: true,
    });
  };

  const handleSave = async () => {
    if (!isFormValid) {
      markAllTouched();
      return;
    }

    setIsSaving(true);

    await saveInventoryItem({
      id: Date.now().toString(),
      name: name.trim(),
      category: inferCategory(name.trim()),
      unit,
      currentStock: Number(currentStock),
      restockThreshold: Number(restockThreshold),
      restockQuantity: Number(restockQuantity),
      location: location.trim(),
      createdAt: new Date().toISOString(),
    });

    setIsSaving(false);
    router.replace("/inventory" as never);
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
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.topBarTitle}>Add Product</Text>
            <View style={styles.iconButton} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={() => markTouched("name")}
                  placeholder="e.g., High Protein Pellets"
                  placeholderTextColor={colors.muted}
                  style={[styles.textInput, nameError ? styles.inputError : null]}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
                {nameError ? (
                  <Text style={styles.errorText}>{nameError}</Text>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Unit</Text>
                <Pressable
                  onPress={() => setUnitPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.selectInput,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.selectText}>{unit}</Text>
                  <Feather name="chevron-down" size={18} color={colors.muted} />
                </Pressable>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Current Stock Quantity</Text>
                <TextInput
                  value={currentStock}
                  onChangeText={(value) =>
                    setCurrentStock(sanitizeDecimalInput(value))
                  }
                  onBlur={() => markTouched("currentStock")}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.textInput,
                    currentStockError ? styles.inputError : null,
                  ]}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                />
                {currentStockError ? (
                  <Text style={styles.errorText}>{currentStockError}</Text>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Restock Threshold</Text>
                <TextInput
                  value={restockThreshold}
                  onChangeText={(value) =>
                    setRestockThreshold(sanitizeDecimalInput(value))
                  }
                  onBlur={() => markTouched("restockThreshold")}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.textInput,
                    restockThresholdError ? styles.inputError : null,
                  ]}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                />
                {restockThresholdError ? (
                  <Text style={styles.errorText}>{restockThresholdError}</Text>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Restock Quantity</Text>
                <TextInput
                  value={restockQuantity}
                  onChangeText={(value) =>
                    setRestockQuantity(sanitizeDecimalInput(value))
                  }
                  onBlur={() => markTouched("restockQuantity")}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.textInput,
                    restockQuantityError ? styles.inputError : null,
                  ]}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                />
                {restockQuantityError ? (
                  <Text style={styles.errorText}>{restockQuantityError}</Text>
                ) : null}
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Location / Farm</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g., North Pond Section A"
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            </View>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.submitButton,
                !isFormValid && styles.submitButtonDisabled,
                pressed && isFormValid && styles.buttonPressed,
              ]}
              accessibilityRole="button"
            >
              <Feather name="plus" size={18} color={colors.white} />
              <Text style={styles.submitButtonText}>
                {isSaving ? "Saving..." : "Add to Inventory"}
              </Text>
            </Pressable>

            <Text style={styles.footerNote}>
              Action will be synced to cloud automatically.
            </Text>
          </ScrollView>

          <BottomNav activeTab="inventory" />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={unitPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setUnitPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            {INVENTORY_UNITS.map((option) => {
              const isSelected = option === unit;

              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setUnit(option);
                    setUnitPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    isSelected && styles.modalOptionSelected,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected ? (
                    <Feather name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    color: colors.textDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
  selectInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  footerNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  modalTitle: {
    color: colors.textDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalOption: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOptionSelected: {
    backgroundColor: colors.softBlue,
  },
  modalOptionText: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },
});
