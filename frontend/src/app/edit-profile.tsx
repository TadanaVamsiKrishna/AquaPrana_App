import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../components/bottom-nav";
import {
  INDIAN_STATES,
  PROFILE_LANGUAGE_OPTIONS,
  getDistrictsForState,
  type ProfileLanguage,
} from "../constants/locations";
import { type AppLanguage, setAppLanguage } from "../i18n";
import { logout } from "../services/auth";
import { saveFarmerProfile } from "../services/local-profile";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "../services/profile";

const colors = {
  primary: "#0A84FF",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0B1F3A",
  muted: "#94A3B8",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  shadow: "#0A4F9E",
  error: "#DC2626",
  disabled: "#B8D8F6",
};

type PickerField = "state" | "district";

function languageLabelToCode(language: string): AppLanguage {
  const normalized = language.trim().toLowerCase();

  if (normalized === "hi" || normalized === "hindi" || normalized.includes("हिन्दी")) {
    return "hi";
  }

  if (normalized === "te" || normalized === "telugu" || normalized.includes("తెలుగు")) {
    return "te";
  }

  return "en";
}

function languageCodeToLabel(code?: string | null): ProfileLanguage {
  const normalized = (code ?? "").trim().toLowerCase();

  if (normalized === "hi" || normalized === "hindi" || normalized.includes("हिन्दी")) {
    return "Hindi";
  }

  if (normalized === "te" || normalized === "telugu" || normalized.includes("తెలుగు")) {
    return "Telugu";
  }

  return "English";
}

function normalizeStoredLanguage(value?: string | null): ProfileLanguage {
  if (!value) {
    return "English";
  }

  return languageCodeToLabel(value);
}

function formatPhone(phone?: string | null) {
  const trimmed = phone?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  return `+${trimmed}`;
}

function FloatingField({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={[styles.outlinedField, error ? styles.outlinedFieldError : null]}>
        <Text style={styles.floatingLabel}>{label}</Text>
        {children}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [district, setDistrict] = useState("");
  const [language, setLanguage] = useState<ProfileLanguage>("English");
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState({
    name: false,
    state: false,
    district: false,
  });

  const districts = useMemo(
    () => getDistrictsForState(selectedState),
    [selectedState],
  );

  const isFormValid =
    name.trim().length > 0 &&
    selectedState.trim().length > 0 &&
    district.trim().length > 0;

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { profile, error } = await getCurrentUserProfile();

    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    if (!profile) {
      setLoadError(t("editProfile.loadFailed"));
      setIsLoading(false);
      return;
    }

    setPhone(formatPhone(profile.phone));
    setName(profile.name ?? "");
    setSelectedState(profile.state ?? "");
    setDistrict(profile.district ?? "");
    setLanguage(normalizeStoredLanguage(profile.language));
    setIsLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const markTouched = (field: keyof typeof touched) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const openPicker = (field: PickerField) => {
    if (field === "district" && !selectedState) {
      markTouched("state");
      Alert.alert(t("editProfile.selectStateFirstTitle"), t("editProfile.selectStateFirst"));
      return;
    }

    setPickerSearchQuery("");
    setActivePicker(field);
  };

  const handleSelectState = (value: string) => {
    setSelectedState(value);
    const nextDistricts = getDistrictsForState(value);
    if (!nextDistricts.includes(district)) {
      setDistrict("");
    }
    setActivePicker(null);
    setPickerSearchQuery("");
  };

  const handleSelectDistrict = (value: string) => {
    setDistrict(value);
    setActivePicker(null);
    setPickerSearchQuery("");
  };

  const filteredOptions = useMemo(() => {
    const options =
      activePicker === "state"
        ? [...INDIAN_STATES]
        : activePicker === "district"
          ? districts
          : [];

    const query = pickerSearchQuery.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(query));
  }, [activePicker, districts, pickerSearchQuery]);

  const handleSave = async () => {
    setTouched({ name: true, state: true, district: true });

    if (!isFormValid) {
      return;
    }

    setIsSaving(true);

    try {
      const trimmedName = name.trim();
      const { error } = await updateCurrentUserProfile({
        name: trimmedName,
        state: selectedState,
        district,
        language,
      });

      if (error) {
        Alert.alert(t("common.error"), error.message || t("editProfile.saveFailed"));
        return;
      }

      await saveFarmerProfile({
        name: trimmedName,
        state: selectedState,
        district,
        language,
      });

      await setAppLanguage(languageLabelToCode(language));

      Alert.alert(t("common.success"), t("editProfile.saveSuccess"));
      await loadProfile();
    } catch (err) {
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("editProfile.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/" as never);
  };

  const nameError =
    touched.name && !name.trim() ? t("editProfile.nameRequired") : null;
  const stateError =
    touched.state && !selectedState ? t("editProfile.stateRequired") : null;
  const districtError =
    touched.district && !district ? t("editProfile.districtRequired") : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Feather name="arrow-left" size={18} color={colors.primary} />
            </Pressable>

            <Text style={styles.headerTitle}>{t("profile.title")}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorStateTitle}>{t("common.error")}</Text>
              <Text style={styles.errorStateBody}>{loadError}</Text>
              <Pressable onPress={() => void loadProfile()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>{t("editProfile.retry")}</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                <View style={styles.avatarBlock}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(name.trim().charAt(0) || "G").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.avatarName}>
                    {name.trim() || t("profile.farmerFallback")}
                  </Text>
                  <Text style={styles.avatarPhone}>
                    {phone || t("profile.phoneFallback")}
                  </Text>
                </View>

                <FloatingField label={t("editProfile.phone")}>
                  <Text style={[styles.fieldValue, styles.readOnlyValue]}>
                    {phone || t("profile.phoneFallback")}
                  </Text>
                </FloatingField>

                <FloatingField label={t("editProfile.fullName")} error={nameError}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    onBlur={() => markTouched("name")}
                    placeholder={t("editProfile.fullNamePlaceholder")}
                    placeholderTextColor={colors.muted}
                    style={styles.textInput}
                    autoCapitalize="words"
                    editable={!isSaving}
                  />
                </FloatingField>

                <FloatingField label={t("editProfile.state")} error={stateError}>
                  <Pressable
                    onPress={() => openPicker("state")}
                    style={styles.selectRow}
                    disabled={isSaving}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.fieldValue,
                        !selectedState && styles.placeholderText,
                      ]}
                    >
                      {selectedState || t("editProfile.selectState")}
                    </Text>
                    <Feather name="chevron-down" size={18} color={colors.muted} />
                  </Pressable>
                </FloatingField>

                <FloatingField label={t("editProfile.district")} error={districtError}>
                  <Pressable
                    onPress={() => openPicker("district")}
                    style={styles.selectRow}
                    disabled={isSaving}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.fieldValue,
                        !district && styles.placeholderText,
                      ]}
                    >
                      {district || t("editProfile.selectDistrict")}
                    </Text>
                    <Feather name="chevron-down" size={18} color={colors.muted} />
                  </Pressable>
                </FloatingField>

                <View style={styles.languageBlock}>
                  <Text style={styles.languageLabel}>
                    {t("editProfile.preferredLanguage")}
                  </Text>
                  <View style={styles.languageRow}>
                    {PROFILE_LANGUAGE_OPTIONS.map((option) => {
                      const selected = language === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setLanguage(option)}
                          disabled={isSaving}
                          style={[
                            styles.languageChip,
                            selected && styles.languageChipSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.languageChipText,
                              selected && styles.languageChipTextSelected,
                            ]}
                          >
                            {option === "English"
                              ? t("language.english")
                              : option === "Hindi"
                                ? t("language.hindi")
                                : t("language.telugu")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Pressable
                  onPress={() => void handleSave()}
                  disabled={isSaving || !isFormValid}
                  style={({ pressed }) => [
                    styles.saveButton,
                    (isSaving || !isFormValid) && styles.saveButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {t("editProfile.saveProfile")}
                    </Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.actionsCard}>
                <Text style={styles.actionsEyebrow}>
                  {t("editProfile.accountActions")}
                </Text>
                <Text style={styles.actionsHint}>
                  {t("editProfile.accountActionsHint")}
                </Text>
                <Pressable
                  onPress={() => void handleSignOut()}
                  style={({ pressed }) => [
                    styles.signOutButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.signOutText}>{t("editProfile.signOut")}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          <BottomNav activeTab="dashboard" />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActivePicker(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {activePicker === "state"
                ? t("editProfile.selectState")
                : t("editProfile.selectDistrict")}
            </Text>

            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color={colors.muted} />
              <TextInput
                value={pickerSearchQuery}
                onChangeText={setPickerSearchQuery}
                placeholder={t("editProfile.search")}
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredOptions.length === 0 ? (
                <Text style={styles.emptyOptions}>{t("editProfile.noResults")}</Text>
              ) : (
                filteredOptions.map((option) => {
                  const selected =
                    activePicker === "state"
                      ? option === selectedState
                      : option === district;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        if (activePicker === "state") {
                          handleSelectState(option);
                        } else {
                          handleSelectDistrict(option);
                        }
                      }}
                      style={[
                        styles.modalOption,
                        selected && styles.modalOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          selected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                      {selected ? (
                        <Feather name="check" size={16} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  screen: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 34 },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  errorStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  errorStateBody: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  avatarBlock: {
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingTop: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  avatarName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  avatarPhone: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  fieldBlock: {
    marginBottom: 12,
  },
  outlinedField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: colors.white,
  },
  outlinedFieldError: {
    borderColor: colors.error,
  },
  floatingLabel: {
    position: "absolute",
    top: -8,
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.white,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  textInput: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 4,
  },
  fieldValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 4,
  },
  readOnlyValue: {
    color: colors.muted,
  },
  placeholderText: {
    color: colors.muted,
    fontWeight: "500",
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    marginLeft: 4,
  },
  languageBlock: {
    marginTop: 4,
    marginBottom: 12,
    gap: 10,
  },
  languageLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
  },
  languageChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  languageChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  languageChipTextSelected: {
    color: colors.white,
  },
  saveButton: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  actionsEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  actionsHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  signOutButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
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
    maxHeight: "70%",
    gap: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 42,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 8,
  },
  modalScroll: {
    maxHeight: 320,
  },
  emptyOptions: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 16,
  },
  modalOption: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOptionSelected: {
    backgroundColor: colors.softBlue,
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  modalOptionTextSelected: {
    color: colors.primary,
  },
  pressed: { opacity: 0.85 },
});
