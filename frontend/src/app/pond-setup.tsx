import { useCallback, useState } from "react";
import * as Location from "expo-location";

import { savePondDraft } from "../services/local-ponds";
import { savePond } from "../services/pond";
import {
  consumePendingPondLocationSelection,
  getPondLocationDisplayLabel,
  reverseGeocodePlaceName,
} from "../lib/pond-location";
import {
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
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
 
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
 
type TouchedFields = {
  pondName: boolean;
  area: boolean;
  depth: boolean;
};
 
const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");
 
  if (parts.length <= 1) {
    return cleanedValue;
  }
 
  return `${parts[0]}.${parts.slice(1).join("")}`;
};
 
const isPositiveNumber = (value: string) => {
  const numberValue = Number(value);
  return value.trim().length > 0 && Number.isFinite(numberValue) && numberValue > 0;
};
 
export default function PondSetupScreen() {
  const router = useRouter();
 
  const [pondName, setPondName] = useState("");
  const [area, setArea] = useState("");
  const [averageDepth, setAverageDepth] = useState("");
 
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [locationPlaceName, setLocationPlaceName] = useState<string | null>(
    null,
  );
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
 
  const [touched, setTouched] = useState<TouchedFields>({
    pondName: false,
    area: false,
    depth: false,
  });
 
  const pondNameError =
    touched.pondName && !pondName.trim() ? "Pond Name is required" : "";
  const areaError =
    touched.area && !area.trim()
      ? "Area is required"
      : touched.area && !isPositiveNumber(area)
        ? "Enter a valid area"
        : "";
  const depthError =
    touched.depth && !averageDepth.trim()
      ? "Average Depth is required"
      : touched.depth && !isPositiveNumber(averageDepth)
        ? "Enter a valid depth"
        : "";
 
  const isFormValid =
    pondName.trim().length > 0 &&
    isPositiveNumber(area) &&
    isPositiveNumber(averageDepth) &&
    location != null;
 
  const markTouched = (field: keyof TouchedFields) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };
 
  const handleAreaChange = (value: string) => {
    setArea(sanitizeDecimalInput(value));
  };
 
  const handleDepthChange = (value: string) => {
    setAverageDepth(sanitizeDecimalInput(value));
  };

  const [localPondId] = useState(() => Date.now().toString());

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingPondLocationSelection();
      if (!pending) {
        return;
      }

      setLocation({
        latitude: pending.latitude,
        longitude: pending.longitude,
      });
      setLocationPlaceName(pending.placeName);
    }, []),
  );

  const handleUseCurrentLocation = async () => {
    setIsCapturingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use your current location. You can still choose your pond manually on the map.",
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitude = currentLocation.coords.latitude;
      const longitude = currentLocation.coords.longitude;

      setLocation({
        latitude,
        longitude,
      });

      const placeName = await reverseGeocodePlaceName(latitude, longitude);
      setLocationPlaceName(placeName);
    } catch (error) {
      console.log("[pond-setup] current location error:", error);
      Alert.alert("Error", "Unable to get current location.");
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const handleOpenGoogleMap = () => {
    router.push("/pond-location-map" as never);
  };

  const selectedLocationLabel = getPondLocationDisplayLabel(
    location ? locationPlaceName : null,
  );
  const handleContinue = async () => {
    if (!isFormValid) {
      setTouched({
        pondName: true,
        area: true,
        depth: true,
      });

      if (!location) {
        Alert.alert(
          "Location required",
          "Please set the pond location using current location or the map before continuing.",
        );
      }

      return;
    }

    await savePondDraft({
      id: localPondId,
      pondName: pondName.trim(),
      area,
      depth: averageDepth,
    });

    // await saveLocalPond({
    //   id: localPondId,
    //   pondName: pondName.trim(),
    //   name: pondName.trim(),
    //   area,
    //   depth: averageDepth,
    //   species: "",
    //   stockingDate: "",
    //   stockingDensity: "",
    //   harvestWindowStart: "",
    //   harvestWindowEnd: "",
    //   cycleDay: "1",
    //   biomass: "—",
    //   survivalRate: "—",
    //   waterQualityStatus: "Not logged",
    //   lastLogTime: "—",
    // });
 

    const { data, error } = await savePond(
 
        pondName,
 
        area,
 
        averageDepth,
 
        location?.latitude,
 
        location?.longitude
 

    );
    console.log("Created Pond ID:", data?.id);
 
    if (error) {
      console.log("Supabase Error:", error);

      Alert.alert(
        "Supabase Error",
        JSON.stringify(error, null, 2)
      );

      return;
    }

    Alert.alert("Success", "Pond Saved Successfully");


    router.push({
      pathname: "/start-journey",
      params: {
        pondId: data.id,
      },
    });
 
};

 
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
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
 
            <Text style={styles.headerTitle}>Setup Pond</Text>
 
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Pond setup",
                  "Add pond specifications to optimize AquaPrana monitoring.",
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
          >
            <View style={styles.headingBlock}>
              <View style={styles.headingIcon}>
                <Feather name="droplet" size={20} color={colors.primary} />
              </View>
              <Text style={styles.title}>Pond Details</Text>
              <Text style={styles.subtitle}>
                Enter the physical specifications of your aquaculture pond to
                optimize monitoring.
              </Text>
            </View>
 
            <View style={styles.formCard}>
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Feather name="edit-3" size={17} color={colors.primary} />
                  <Text style={styles.label}>Pond Name</Text>
                </View>
 
                <TextInput
                  value={pondName}
                  onChangeText={setPondName}
                  onBlur={() => markTouched("pondName")}
                  placeholder="e.g. North Basin A-1"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.textInput,
                    pondNameError ? styles.inputError : null,
                  ]}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
 
                {pondNameError ? (
                  <Text style={styles.errorText}>{pondNameError}</Text>
                ) : null}
              </View>
 
              <View style={styles.metricsRow}>
                <View style={[styles.metricField, styles.metricFieldLeft]}>
                  <View style={styles.labelRow}>
                    <Feather name="maximize-2" size={17} color={colors.primary} />
                    <Text style={styles.label}>Area in Acres</Text>
                  </View>
 
                  <View
                    style={[
                      styles.numericInputShell,
                      areaError ? styles.inputError : null,
                    ]}
                  >
                    <TextInput
                      value={area}
                      onChangeText={handleAreaChange}
                      onBlur={() => markTouched("area")}
                      placeholder="0.0"
                      placeholderTextColor={colors.muted}
                      style={styles.numericInput}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      returnKeyType="done"
                    />
                    <Text style={styles.suffix}>Acres</Text>
                  </View>
 
                  {areaError ? (
                    <Text style={styles.errorText}>{areaError}</Text>
                  ) : null}
                </View>
 
                <View style={styles.metricField}>
                  <View style={styles.labelRow}>
                    <Feather name="activity" size={17} color={colors.primary} />
                    <Text style={styles.label}>Avg. Depth</Text>
                  </View>
 
                  <View
                    style={[
                      styles.numericInputShell,
                      depthError ? styles.inputError : null,
                    ]}
                  >
                    <TextInput
                      value={averageDepth}
                      onChangeText={handleDepthChange}
                      onBlur={() => markTouched("depth")}
                      placeholder="0.0"
                      placeholderTextColor={colors.muted}
                      style={styles.numericInput}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      returnKeyType="done"
                    />
                    <Text style={styles.suffix}>Feet</Text>
                  </View>
 
                  {depthError ? (
                    <Text style={styles.errorText}>{depthError}</Text>
                  ) : null}
                </View>
              </View>
            </View>
 
            <View style={styles.locationCard}>
              <View style={styles.locationTopRow}>
                <View style={styles.locationIconCircle}>
                  <Feather name="map-pin" size={22} color={colors.primary} />
                </View>

                <View style={styles.locationCopy}>
                  <Text style={styles.locationTitle}>Pond Location</Text>
                  <Text style={styles.locationSubtitle}>
                    Choose how you want to set the pond location.
                  </Text>
                </View>
              </View>

              <View style={styles.locationOptionCard}>
                <View style={styles.locationOptionHeader}>
                  <Text style={styles.locationOptionEmoji}>📍</Text>
                  <Text style={styles.locationOptionTitle}>
                    Use Current Location
                  </Text>
                </View>
                <Text style={styles.locationOptionDescription}>
                  Automatically detect your current GPS location.
                </Text>
                <Pressable
                  onPress={() => {
                    void handleUseCurrentLocation();
                  }}
                  disabled={isCapturingLocation}
                  style={({ pressed }) => [
                    styles.locationButton,
                    (pressed || isCapturingLocation) &&
                      styles.locationButtonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="navigation" size={18} color={colors.primary} />
                  <Text style={styles.locationButtonText}>
                    {isCapturingLocation
                      ? "Detecting..."
                      : "Use Current Location"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.locationOptionCard}>
                <View style={styles.locationOptionHeader}>
                  <Text style={styles.locationOptionEmoji}>🗺️</Text>
                  <Text style={styles.locationOptionTitle}>
                    Select on Google Map
                  </Text>
                </View>
                <Text style={styles.locationOptionDescription}>
                  Choose the exact pond location by placing a pin on the map.
                </Text>
                <Pressable
                  onPress={handleOpenGoogleMap}
                  style={({ pressed }) => [
                    styles.locationButton,
                    pressed && styles.locationButtonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="map" size={18} color={colors.primary} />
                  <Text style={styles.locationButtonText}>Open Google Map</Text>
                </Pressable>
              </View>

              <View style={styles.selectedLocationBox}>
                <Text style={styles.selectedLocationTitle}>
                  Selected Pond Location
                </Text>
                <Text style={styles.selectedLocationValue}>
                  {selectedLocationLabel}
                </Text>
              </View>
            </View>
          </ScrollView>
 
          <View style={styles.footer}>
            <Pressable
              onPress={handleContinue}
              disabled={!isFormValid}
              style={({ pressed }) => [
                styles.continueButton,
                !isFormValid && styles.continueButtonDisabled,
                pressed && isFormValid && styles.continueButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isFormValid }}
            >
              <Text style={styles.continueButtonText}>Continue →</Text>
            </Pressable>
          </View>
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
  header: {
    height: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headingBlock: {
    marginBottom: 22,
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginLeft: 8,
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
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metricField: {
    flex: 1,
  },
  metricFieldLeft: {
    marginRight: 12,
  },
  numericInputShell: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  numericInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    padding: 0,
  },
  suffix: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginLeft: 6,
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
  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
  },
  locationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  locationIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  locationCopy: {
    flex: 1,
  },
  locationTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  locationSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 3,
  },
  locationOptionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paleBlue,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  locationOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationOptionEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  locationOptionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
  },
  locationOptionDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 12,
  },
  locationButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  locationButtonPressed: {
    opacity: 0.82,
  },
  locationButtonText: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginLeft: 8,
  },
  selectedLocationBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: colors.softBlue,
    borderRadius: 10,
  },
  selectedLocationTitle: {
    fontWeight: "700",
    color: colors.text,
    fontSize: 15,
  },
  selectedLocationValue: {
    marginTop: 6,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: colors.background,
  },
  continueButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
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
  continueButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonPressed: {
    opacity: 0.9,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
  },
});
 