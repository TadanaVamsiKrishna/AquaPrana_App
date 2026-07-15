import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  pickRecordImage,
} from "../lib/record-images";
import {
  getParameterStatus,
  WATER_PARAMETERS,
  type WaterParameterKey,
} from "../lib/water-quality";

import { saveDailyLog } from "../services/dailyLogs";
import {
  getSupabasePondById,
  mapSupabasePondName,
} from "../services/pond";

import type { StoredPond } from "../services/local-ponds";


const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  neutralInput: "#F1F5F9",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  warningSoft: "#DBEAFE",
};

type FormState = {
  dissolvedOxygen: string;
  ph: string;
  temperature: string;
  salinity: string;
  ammonia: string;
  calcium: string;
  magnesium: string;
  potassium: string;
  feedQty: string;
  feedBrand: string;
  mortalityCount: string;
  abwSample: string;
  treatment: string;
  notes: string;
};

type TouchedWaterFields = Record<keyof Pick<
  FormState,
  | "dissolvedOxygen"
  | "ph"
  | "temperature"
  | "salinity"
  | "ammonia"
  | "calcium"
  | "magnesium"
  | "potassium"
>, boolean>;

const emptyForm: FormState = {
  dissolvedOxygen: "",
  ph: "",
  temperature: "",
  salinity: "",
  ammonia: "",
  calcium: "",
  magnesium: "",
  potassium: "",
  feedQty: "",
  feedBrand: "",
  mortalityCount: "",
  abwSample: "",
  treatment: "",
  notes: "",
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

const formKeyMap: Record<WaterParameterKey, keyof TouchedWaterFields> = {
  do: "dissolvedOxygen",
  ph: "ph",
  temperature: "temperature",
  salinity: "salinity",
  ammonia: "ammonia",
  calcium: "calcium",
  magnesium: "magnesium",
  potassium: "potassium",
};

function getObservationTime() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getWaterValueColors(
  value: string,
  statusKey: WaterParameterKey,
  touched: boolean,
) {
  if (!touched || value.trim() === "") {
    return {
      backgroundColor: colors.neutralInput,
      textColor: colors.text,
    };
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return {
      backgroundColor: colors.neutralInput,
      textColor: colors.text,
    };
  }

  const status = getParameterStatus(statusKey, num);

  if (status === "good") {
    return {
      backgroundColor: colors.successSoft,
      textColor: colors.success,
    };
  }

  if (status === "attention") {
    return {
      backgroundColor: colors.warningSoft,
      textColor: colors.primary,
    };
  }

  if (status === "critical") {
    return {
      backgroundColor: colors.dangerSoft,
      textColor: colors.danger,
    };
  }

  return {
    backgroundColor: colors.neutralInput,
    textColor: colors.text,
  };
}

function ParameterRow({
  label,
  value,
  safeRange,
  statusKey,
  touched,
  photoUri,
  isPhotoLoading,
  onChangeText,
  onPhotoPress,
}: {
  label: string;
  value: string;
  safeRange: string;
  statusKey: WaterParameterKey;
  touched: boolean;
  photoUri?: string;
  isPhotoLoading?: boolean;
  onChangeText: (value: string) => void;
  onPhotoPress: () => void;
}) {
  const valueColors = getWaterValueColors(value, statusKey, touched);

  return (
    <View style={styles.parameterRow}>
      <View style={styles.parameterMain}>
        <Text style={styles.parameterLabel}>{label}</Text>
        <View
          style={[
            styles.parameterValueShell,
            { backgroundColor: valueColors.backgroundColor },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="—"
            placeholderTextColor={colors.muted}
            style={[styles.parameterInput, { color: valueColors.textColor }]}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
        <Text style={styles.parameterRange}>Target: {safeRange}</Text>
      </View>

      <Pressable
        onPress={onPhotoPress}
        disabled={isPhotoLoading}
        style={({ pressed }) => [
          styles.photoIconButton,
          pressed && styles.pressed,
          isPhotoLoading && styles.photoIconButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Upload photo for ${label}`}
      >
        {isPhotoLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.parameterPhotoPreview}
            contentFit="cover"
          />
        ) : (
          <Feather name="camera" size={16} color={colors.muted} />
        )}
      </Pressable>
    </View>
  );
}

function ManagementRow({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View style={styles.managementRow}>
      <View style={styles.managementLeft}>
        <Feather name={icon} size={16} color={colors.primary} />
        <Text style={styles.managementLabel}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.managementInput}
        keyboardType={keyboardType}
        inputMode={keyboardType === "decimal-pad" ? "decimal" : "text"}
      />
    </View>
  );
}

export default function DailyLogEntryScreen() {
  const router = useRouter();
  // const { pondId: pondIdParam } = useLocalSearchParams<{ pondId: string }>();
  // const pondId = resolvePondId(pondIdParam);

  const { pondId } = useLocalSearchParams<{ pondId?: string }>();
  const [pond, setPond] = useState<StoredPond | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [observationTime, setObservationTime] = useState(getObservationTime());
  const [isSaving, setIsSaving] = useState(false);
  const [touchedWater, setTouchedWater] = useState<TouchedWaterFields>({
    dissolvedOxygen: false,
    ph: false,
    temperature: false,
    salinity: false,
    ammonia: false,
    calcium: false,
    magnesium: false,
    potassium: false,
  });
  const [parameterPhotos, setParameterPhotos] = useState<
    Partial<Record<keyof TouchedWaterFields, string>>
  >({});
  const [photoLoadingKey, setPhotoLoadingKey] = useState<
    keyof TouchedWaterFields | "checkTray" | null
  >(null);
  const [checkTrayPhoto, setCheckTrayPhoto] = useState<string | null>(null);
  const isPickingPhotoRef = useRef(false);


  const loadPond = useCallback(async () => {
    if (!pondId) {
      return;
    }

    try {
      const pondData = await getSupabasePondById(pondId);
    
      setPond({
        id: pondData.id,
        pondName: mapSupabasePondName(pondData),
        area: String(pondData.area_acres ?? ""),
        depth: String(pondData.depth_ft ?? ""),
        species: "",
        stockingDate: "",
        stockingDensity: "",
        harvestWindowStart: "",
        harvestWindowEnd: "",
        cycleDay: "1",
        biomass: "",
        survivalRate: "",
        waterQualityStatus: "Not logged",
        lastLogTime: "",
      });
    
      setForm(emptyForm);
    
      setTouchedWater({
        dissolvedOxygen: false,
        ph: false,
        temperature: false,
        salinity: false,
        ammonia: false,
        calcium: false,
        magnesium: false,
        potassium: false,
      });
    
      setObservationTime(getObservationTime());
    
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Unable to load pond.");
    }

  }, [pondId]);

  // useEffect(() => {
  //   if (!pondId) {
  //     return;
  //   }

  //   resetForm();
  //   void loadPondMeta();
  // }, [pondId, loadPondMeta, resetForm]);

  useEffect(() => {
    if (!pondId) return;
  
    void loadPond();
  }, [pondId, loadPond]);

  // useFocusEffect(
  //   useCallback(() => {
  //     if (isPickingPhotoRef.current) {
  //       return;
  //     }

  //     void loadPondMeta();
  //   }, [loadPondMeta]),
  // );


  useFocusEffect(
    useCallback(() => {
  
      loadPond();
    }, [ loadPond]),
  );

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateWaterField = (
    key: keyof TouchedWaterFields,
    value: string,
  ) => {
    setTouchedWater((current) => ({ ...current, [key]: true }));
    updateForm(key, sanitizeDecimalInput(value));
  };

  const handleParameterPhoto = async (fieldKey: keyof TouchedWaterFields) => {
    isPickingPhotoRef.current = true;
    setPhotoLoadingKey(fieldKey);

    try {
      const picked = await pickRecordImage();
      if (picked?.uri) {
        setParameterPhotos((current) => ({
          ...current,
          [fieldKey]: picked.uri,
        }));
      }
    } catch (error) {
      Alert.alert(
        "Photo error",
        error instanceof Error
          ? error.message
          : "Unable to open camera or gallery.",
      );
    } finally {
      setPhotoLoadingKey(null);
      isPickingPhotoRef.current = false;
    }
  };

  const handleCheckTrayPhoto = async () => {
    isPickingPhotoRef.current = true;
    setPhotoLoadingKey("checkTray");

    try {
      const picked = await pickRecordImage();
      if (picked?.uri) {
        setCheckTrayPhoto(picked.uri);
      }
    } catch (error) {
      Alert.alert(
        "Photo error",
        error instanceof Error
          ? error.message
          : "Unable to open camera or gallery.",
      );
    } finally {
      setPhotoLoadingKey(null);
      isPickingPhotoRef.current = false;
    }
  };

  const handleSave = async () => {
    if (!pondId) {

      Alert.alert("Pond not found");
      return;
    }
  

    setIsSaving(true);
  
    try {
      const now = new Date();
  
      const [hours, minutes] = observationTime.split(":");
  
      now.setHours(Number(hours), Number(minutes), 0, 0);
  
      await saveDailyLog({
        pondId,
  
        observedAt: now.toISOString(),
  
        dissolvedOxygen: form.dissolvedOxygen,
        ph: form.ph,
        temperature: form.temperature,
        salinity: form.salinity,
        ammonia: form.ammonia,
  
        calcium: form.calcium,
        magnesium: form.magnesium,
        potassium: form.potassium,
  
        feedQty: form.feedQty,
        feedBrand: form.feedBrand,
  
        mortalityCount: form.mortalityCount,
  
        abwSample: form.abwSample,
  
        treatment: form.treatment,
  
        notes: form.notes,
      });
  
      Alert.alert("Success", "Daily log saved successfully.");

      router.replace({
        pathname: "/daily-log",
        params: { pondId },
      } as never);
    } catch (e) {
      console.log(e);


      const message =
        e instanceof Error && e.message
          ? e.message
          : "Unable to save daily log.";

      Alert.alert("Error", message);

    } finally {
      setIsSaving(false);
    }
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
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Feather name="arrow-left" size={22} color={colors.primary} />
            </Pressable>
            <Text style={styles.topBarTitle}>Daily Log Entry</Text>
            <Pressable
              onPress={() => void handleSave()}
              disabled={isSaving || !pondId}
              style={({ pressed }) => [
                styles.saveButton,
                (isSaving || !pondId) && styles.saveButtonDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pondBanner}>
              <Text style={styles.pondBannerText}>
                {pond?.pondName ?? "Selected Pond"}
              </Text>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Observation Time <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.timeInputShell}>
                <TextInput
                  value={observationTime}
                  onChangeText={setObservationTime}
                  style={styles.timeInput}
                  placeholder="10:22"
                  placeholderTextColor={colors.muted}
                />
                <Feather name="clock" size={18} color={colors.muted} />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Feather name="droplet" size={16} color="#16A34A" />
              <Text style={styles.sectionTitle}>Water Quality</Text>
            </View>

            <View style={styles.card}>
              {WATER_PARAMETERS.map((parameter) => {
                const fieldKey = formKeyMap[parameter.key];

                return (
                  <ParameterRow
                    key={parameter.key}
                    label={parameter.label}
                    safeRange={parameter.safeRange}
                    statusKey={parameter.key}
                    touched={touchedWater[fieldKey]}
                    value={form[fieldKey]}
                    photoUri={parameterPhotos[fieldKey]}
                    isPhotoLoading={photoLoadingKey === fieldKey}
                    onChangeText={(value) => updateWaterField(fieldKey, value)}
                    onPhotoPress={() => void handleParameterPhoto(fieldKey)}
                  />
                );
              })}
            </View>

            <View style={styles.sectionHeader}>
              <Feather name="settings" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Farm Management</Text>
            </View>

            <View style={styles.card}>
              <ManagementRow
                icon="package"
                label="Feed Qty (kg)"
                value={form.feedQty}
                onChangeText={(value) =>
                  updateForm("feedQty", sanitizeDecimalInput(value))
                }
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
              <ManagementRow
                icon="credit-card"
                label="Feed Brand"
                value={form.feedBrand}
                onChangeText={(value) => updateForm("feedBrand", value)}
                placeholder="Type brand..."
              />
              <ManagementRow
                icon="heart"
                label="Mortality Count"
                value={form.mortalityCount}
                onChangeText={(value) =>
                  updateForm("mortalityCount", sanitizeIntegerInput(value))
                }
                placeholder="0"
                keyboardType="number-pad"
              />
              <ManagementRow
                icon="clock"
                label="ABW Sample (g)"
                value={form.abwSample}
                onChangeText={(value) =>
                  updateForm("abwSample", sanitizeDecimalInput(value))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.card}>
              <ManagementRow
                icon="briefcase"
                label="Treatment Applied"
                value={form.treatment}
                onChangeText={(value) => updateForm("treatment", value)}
                placeholder="E.g. Lime, Probiotics..."
              />

              <View style={styles.notesBlock}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={form.notes}
                  onChangeText={(value) => updateForm("notes", value)}
                  placeholder="Any additional observations..."
                  placeholderTextColor={colors.muted}
                  style={styles.notesInput}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.photoSection}>
              <View style={styles.photoSectionHeader}>
                <Feather name="image" size={16} color={colors.primary} />
                <View style={styles.photoHeaderCopy}>
                  <Text style={styles.photoTitle}>CHECK TRAY PHOTO</Text>
                  <Text style={styles.photoSubtitle}>
                    Upload a check tray image to evaluate feed intake.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => void handleCheckTrayPhoto()}
                disabled={photoLoadingKey === "checkTray"}
                style={({ pressed }) => [
                  styles.photoUpload,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                {photoLoadingKey === "checkTray" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : checkTrayPhoto ? (
                  <Image
                    source={{ uri: checkTrayPhoto }}
                    style={styles.checkTrayPreview}
                    contentFit="cover"
                  />
                ) : (
                  <Feather name="image" size={22} color={colors.primary} />
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },
  saveButton: {
    backgroundColor: colors.softBlue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  pondBanner: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  pondBannerText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  required: {
    color: colors.danger,
  },
  timeInputShell: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.neutralInput,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 14,
  },
  parameterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  parameterMain: {
    flex: 1,
    gap: 6,
  },
  parameterLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  parameterValueShell: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: "center",
  },
  parameterInput: {
    fontSize: 16,
    fontWeight: "700",
    padding: 0,
  },
  parameterRange: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  photoIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    overflow: "hidden",
  },
  photoIconButtonDisabled: {
    opacity: 0.7,
  },
  parameterPhotoPreview: {
    width: "100%",
    height: "100%",
  },
  checkTrayPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  managementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  managementLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 148,
  },
  managementLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  managementInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.neutralInput,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  notesBlock: {
    gap: 8,
    paddingTop: 4,
  },
  notesInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.neutralInput,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  photoSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  photoSectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  photoHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  photoTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  photoSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  photoUpload: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.88,
  },
});
