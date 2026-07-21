import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as Location from "expo-location";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPondLocationDisplayLabel,
  reverseGeocodePlaceName,
  setPendingPondLocationSelection,
} from "../lib/pond-location";

const colors = {
  primary: "#0A84FF",
  background: "#F4FAFF",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6E4F0",
  softBlue: "#EAF5FF",
  shadow: "#0A4F9E",
};

const DEFAULT_REGION: Region = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function PondLocationMapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [marker, setMarker] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const [placeName, setPlaceName] = useState("Selected Location");
  const [isReady, setIsReady] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const updatePlaceName = useCallback(
    async (latitude: number, longitude: number) => {
      setIsGeocoding(true);
      try {
        const label = await reverseGeocodePlaceName(latitude, longitude);
        setPlaceName(label);
      } finally {
        setIsGeocoding(false);
      }
    },
    [],
  );

  const scheduleGeocode = useCallback(
    (latitude: number, longitude: number) => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }

      geocodeTimerRef.current = setTimeout(() => {
        void updatePlaceName(latitude, longitude);
      }, 450);
    },
    [updatePlaceName],
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (!mounted) {
            return;
          }

          const next: Region = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          };
          setMarker({
            latitude: next.latitude,
            longitude: next.longitude,
          });
          mapRef.current?.animateToRegion(next, 400);
          await updatePlaceName(next.latitude, next.longitude);
        } else {
          await updatePlaceName(
            DEFAULT_REGION.latitude,
            DEFAULT_REGION.longitude,
          );
        }
      } catch (error) {
        console.log("[pond-location-map] bootstrap error:", error);
        if (mounted) {
          await updatePlaceName(
            DEFAULT_REGION.latitude,
            DEFAULT_REGION.longitude,
          );
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
    };
  }, [updatePlaceName]);

  const handleMapPress = (event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    scheduleGeocode(latitude, longitude);
  };

  const handleMarkerDragEnd = (event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    scheduleGeocode(latitude, longitude);
  };

  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      let label = placeName;
      if (isGeocoding || !label.trim()) {
        label = await reverseGeocodePlaceName(
          marker.latitude,
          marker.longitude,
        );
      }

      setPendingPondLocationSelection({
        latitude: marker.latitude,
        longitude: marker.longitude,
        placeName: label,
      });

      router.back();
    } catch (error) {
      console.log("[pond-location-map] confirm error:", error);
      Alert.alert(
        "Unable to confirm location",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Select on Map</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <View style={styles.mapWrap}>
        {!isReady ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={
            Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
          }
          initialRegion={DEFAULT_REGION}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          <Marker
            coordinate={marker}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        </MapView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.selectedTitle}>Selected Location</Text>
        <Text style={styles.selectedValue}>
          {isGeocoding
            ? "📍 Looking up place name..."
            : getPondLocationDisplayLabel(placeName)}
        </Text>

        <Pressable
          onPress={() => {
            void handleConfirm();
          }}
          disabled={isConfirming || isGeocoding}
          style={({ pressed }) => [
            styles.confirmButton,
            (pressed || isConfirming || isGeocoding) && styles.pressed,
            (isConfirming || isGeocoding) && styles.confirmButtonDisabled,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.confirmButtonText}>
            {isConfirming ? "Confirming..." : "Confirm Location"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(244,250,255,0.72)",
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  selectedTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedValue: {
    marginTop: 6,
    marginBottom: 14,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  confirmButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.88,
  },
});
