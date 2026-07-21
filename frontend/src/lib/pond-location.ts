import * as Location from "expo-location";
import { Platform } from "react-native";

const FALLBACK_LABEL = "Selected Location";
const NO_LOCATION_LABEL = "No location selected";

function addUniquePart(
  parts: string[],
  seen: Set<string>,
  value?: string | null,
) {
  const cleaned = value?.trim();
  if (!cleaned) {
    return;
  }

  const key = cleaned.toLowerCase();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  parts.push(cleaned);
}

/** Build a readable place name from reverse-geocode fields. */
export function formatPlaceNameFromGeocode(
  address: Location.LocationGeocodedAddress,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  addUniquePart(parts, seen, address.city);
  addUniquePart(parts, seen, address.name);
  addUniquePart(parts, seen, address.subregion);
  addUniquePart(parts, seen, address.district);
  addUniquePart(parts, seen, address.region);

  return parts.slice(0, 3).join(", ");
}

function formatPlaceNameFromNominatim(data: {
  address?: Record<string, string | undefined>;
  display_name?: string;
}): string {
  const address = data.address ?? {};
  const parts: string[] = [];
  const seen = new Set<string>();

  addUniquePart(
    parts,
    seen,
    address.village ||
      address.hamlet ||
      address.suburb ||
      address.town ||
      address.city ||
      address.municipality ||
      address.county,
  );
  addUniquePart(
    parts,
    seen,
    address.county || address.state_district || address.district,
  );
  addUniquePart(parts, seen, address.state);

  if (parts.length > 0) {
    return parts.slice(0, 3).join(", ");
  }

  const display = data.display_name?.split(",").slice(0, 3).join(",").trim();
  return display || FALLBACK_LABEL;
}

async function reverseGeocodeWithNominatim(
  latitude: number,
  longitude: number,
): Promise<string> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(latitude),
    )}&lon=${encodeURIComponent(String(longitude))}&zoom=14&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AquaPrana/1.0 (pond-location)",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    address?: Record<string, string | undefined>;
    display_name?: string;
  };

  return formatPlaceNameFromNominatim(data);
}

export async function reverseGeocodePlaceName(
  latitude: number,
  longitude: number,
): Promise<string> {
  // Expo Location reverse geocode is removed on web (SDK 49+).
  if (Platform.OS !== "web") {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (results?.length) {
        const formatted = formatPlaceNameFromGeocode(results[0]);
        if (formatted) {
          return formatted;
        }
      }
    } catch (error) {
      console.log("[pond-location] expo reverse geocode failed:", error);
    }
  }

  try {
    return await reverseGeocodeWithNominatim(latitude, longitude);
  } catch (error) {
    console.log("[pond-location] nominatim reverse geocode failed:", error);
    return FALLBACK_LABEL;
  }
}

export function getPondLocationDisplayLabel(
  placeName: string | null | undefined,
): string {
  const cleaned = placeName?.trim();
  if (!cleaned || cleaned === NO_LOCATION_LABEL) {
    return `📍 ${NO_LOCATION_LABEL}`;
  }

  return `📍 ${cleaned}`;
}

export type PondLocationSelection = {
  latitude: number;
  longitude: number;
  placeName: string;
};

let pendingMapSelection: PondLocationSelection | null = null;

export function setPendingPondLocationSelection(
  selection: PondLocationSelection,
) {
  pendingMapSelection = selection;
}

export function consumePendingPondLocationSelection(): PondLocationSelection | null {
  const next = pendingMapSelection;
  pendingMapSelection = null;
  return next;
}

export function getGoogleMapsApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

export { FALLBACK_LABEL, NO_LOCATION_LABEL };
