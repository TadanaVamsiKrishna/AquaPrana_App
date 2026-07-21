import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getGoogleMapsApiKey,
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

const DEFAULT = {
  latitude: 17.385,
  longitude: 78.4867,
  zoom: 14,
};

type LatLng = { latitude: number; longitude: number };

declare global {
  interface Window {
    google?: any;
    __aquapranaMapsInit?: () => void;
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document unavailable"));
      return;
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any).dataset.loaded === "true" || window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`)),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      (script as any).dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadStylesheet(href: string, id: string) {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function ensureLeaflet(): Promise<any> {
  loadStylesheet(
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "leaflet-css",
  );
  await loadScript(
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "leaflet-js",
  );
  return (window as any).L;
}

async function ensureGoogleMaps(apiKey: string): Promise<any> {
  if (window.google?.maps) {
    return window.google.maps;
  }

  await new Promise<void>((resolve, reject) => {
    const callbackName = "__aquapranaMapsInit";
    window[callbackName] = () => {
      resolve();
    };

    const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&callback=${callbackName}`;

    loadScript(src, "google-maps-js").catch(reject);

    // Safety timeout if callback never fires.
    setTimeout(() => {
      if (window.google?.maps) {
        resolve();
      }
    }, 8000);
  });

  return window.google.maps;
}

export default function PondLocationMapScreen() {
  const router = useRouter();
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineRef = useRef<"google" | "leaflet" | null>(null);

  const [marker, setMarker] = useState<LatLng>({
    latitude: DEFAULT.latitude,
    longitude: DEFAULT.longitude,
  });
  const [placeName, setPlaceName] = useState("Selected Location");
  const [isReady, setIsReady] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [engineLabel, setEngineLabel] = useState("Map");

  const scheduleGeocode = useCallback((latitude: number, longitude: number) => {
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
    }

    geocodeTimerRef.current = setTimeout(() => {
      setIsGeocoding(true);
      void reverseGeocodePlaceName(latitude, longitude)
        .then(setPlaceName)
        .finally(() => setIsGeocoding(false));
    }, 400);
  }, []);

  const moveMarker = useCallback(
    (latitude: number, longitude: number, pan = true) => {
      setMarker({ latitude, longitude });
      scheduleGeocode(latitude, longitude);

      const engine = engineRef.current;
      if (engine === "google" && markerRef.current && mapInstanceRef.current) {
        const position = { lat: latitude, lng: longitude };
        markerRef.current.setPosition(position);
        if (pan) {
          mapInstanceRef.current.panTo(position);
        }
      }

      if (engine === "leaflet" && markerRef.current && mapInstanceRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        if (pan) {
          mapInstanceRef.current.panTo([latitude, longitude]);
        }
      }
    },
    [scheduleGeocode],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        let start = {
          latitude: DEFAULT.latitude,
          longitude: DEFAULT.longitude,
        };

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            start = {
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            };
          }
        } catch (error) {
          console.log("[pond-location-map.web] location bootstrap:", error);
        }

        if (cancelled) {
          return;
        }

        setMarker(start);
        setIsGeocoding(true);
        const label = await reverseGeocodePlaceName(
          start.latitude,
          start.longitude,
        );
        if (!cancelled) {
          setPlaceName(label);
          setIsGeocoding(false);
        }

        await new Promise((resolve) => setTimeout(resolve, 80));
        if (cancelled) {
          return;
        }

        const host = document.getElementById("aquaprana-pond-map");
        if (!host) {
          throw new Error("Map container not found");
        }

        const apiKey = getGoogleMapsApiKey();

        if (apiKey) {
          try {
            const maps = await ensureGoogleMaps(apiKey);
            if (cancelled) {
              return;
            }

            const map = new maps.Map(host, {
              center: { lat: start.latitude, lng: start.longitude },
              zoom: DEFAULT.zoom,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            });

            const googleMarker = new maps.Marker({
              position: { lat: start.latitude, lng: start.longitude },
              map,
              draggable: true,
            });

            map.addListener("click", (event: any) => {
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              moveMarker(lat, lng, false);
            });

            googleMarker.addListener("dragend", (event: any) => {
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              moveMarker(lat, lng, false);
            });

            mapInstanceRef.current = map;
            markerRef.current = googleMarker;
            engineRef.current = "google";
            setEngineLabel("Google Map");
            setIsReady(true);
            return;
          } catch (error) {
            console.log(
              "[pond-location-map.web] Google Maps failed, using OpenStreetMap:",
              error,
            );
          }
        }

        const L = await ensureLeaflet();
        if (cancelled) {
          return;
        }

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(host, {
          zoomControl: true,
        }).setView([start.latitude, start.longitude], DEFAULT.zoom);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        const leafletMarker = L.marker([start.latitude, start.longitude], {
          draggable: true,
        }).addTo(map);

        map.on("click", (event: any) => {
          moveMarker(event.latlng.lat, event.latlng.lng, false);
        });

        leafletMarker.on("dragend", () => {
          const position = leafletMarker.getLatLng();
          moveMarker(position.lat, position.lng, false);
        });

        // Leaflet needs invalidateSize after flex layout.
        setTimeout(() => {
          map.invalidateSize();
        }, 150);

        mapInstanceRef.current = map;
        markerRef.current = leafletMarker;
        engineRef.current = "leaflet";
        setEngineLabel("Map");
        setIsReady(true);
      } catch (error) {
        console.log("[pond-location-map.web] init error:", error);
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "Unable to open the map. Please try again.",
          );
          setIsReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
      try {
        if (engineRef.current === "leaflet" && mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [moveMarker]);

  const handleConfirm = async () => {
    if (isConfirming || mapError) {
      return;
    }

    setIsConfirming(true);
    try {
      let label = placeName;
      if (isGeocoding || !label.trim() || label === "Selected Location") {
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
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
        <Text style={styles.headerTitle}>Select on {engineLabel}</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <View style={styles.mapWrap}>
        {createElement("div", {
          id: "aquaprana-pond-map",
          style: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: "100%",
            height: "100%",
          },
        })}

        {!isReady ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : null}

        {mapError ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Unable to open map</Text>
            <Text style={styles.errorBody}>{mapError}</Text>
          </View>
        ) : null}
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
          disabled={isConfirming || !!mapError}
          style={({ pressed }) => [
            styles.confirmButton,
            (pressed || isConfirming) && styles.pressed,
            (isConfirming || !!mapError) && styles.confirmButtonDisabled,
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
    position: "relative",
    overflow: "hidden",
    minHeight: 320,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(244,250,255,0.8)",
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "700",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.white,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  errorBody: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
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
