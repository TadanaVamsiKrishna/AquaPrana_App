import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export type WeatherIconName =
  | "sun"
  | "cloud"
  | "cloud-rain"
  | "cloud-lightning"
  | "cloud-snow"
  | "cloud-drizzle";

export type WeatherSnapshot = {
  temperatureC: number;
  condition: string;
  icon: WeatherIconName;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  source: "openweather" | "open-meteo";
};

const CACHE_PREFIX = "aquaprana.weather.v1:";
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(latitude: number, longitude: number) {
  return `${CACHE_PREFIX}${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function titleCaseCondition(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function mapOpenWeatherIcon(main: string, description: string): WeatherIconName {
  const key = `${main} ${description}`.toLowerCase();

  if (key.includes("thunder")) return "cloud-lightning";
  if (key.includes("drizzle")) return "cloud-drizzle";
  if (key.includes("rain")) return "cloud-rain";
  if (key.includes("snow")) return "cloud-snow";
  if (key.includes("fog") || key.includes("mist") || key.includes("haze")) {
    return "cloud";
  }
  if (key.includes("clear")) return "sun";
  return "cloud";
}

function mapOpenMeteo(code: number): { condition: string; icon: WeatherIconName } {
  if (code === 0) return { condition: "Sunny", icon: "sun" };
  if (code === 1 || code === 2) {
    return { condition: "Partly Cloudy", icon: "cloud" };
  }
  if (code === 3) return { condition: "Cloudy", icon: "cloud" };
  if (code === 45 || code === 48) return { condition: "Fog", icon: "cloud" };
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { condition: "Drizzle", icon: "cloud-drizzle" };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { condition: "Rain", icon: "cloud-rain" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { condition: "Snow", icon: "cloud-snow" };
  }
  if ([95, 96, 99].includes(code)) {
    return { condition: "Thunderstorm", icon: "cloud-lightning" };
  }
  return { condition: "Cloudy", icon: "cloud" };
}

async function readCache(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as WeatherSnapshot;
  } catch {
    return null;
  }
}

async function writeCache(snapshot: WeatherSnapshot) {
  try {
    await AsyncStorage.setItem(
      cacheKey(snapshot.latitude, snapshot.longitude),
      JSON.stringify(snapshot),
    );
  } catch (error) {
    console.log("[weather] cache write failed:", error);
  }
}

function isFresh(snapshot: WeatherSnapshot) {
  const age = Date.now() - Date.parse(snapshot.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
}

async function fetchOpenWeather(
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<WeatherSnapshot> {
  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap failed (${response.status})`);
  }

  const data = (await response.json()) as {
    main?: { temp?: number };
    weather?: Array<{ main?: string; description?: string }>;
  };

  const temperatureC = data.main?.temp;
  const weather = data.weather?.[0];
  if (temperatureC == null || !Number.isFinite(temperatureC) || !weather) {
    throw new Error("OpenWeatherMap returned incomplete data");
  }

  return {
    temperatureC: Math.round(temperatureC),
    condition: titleCaseCondition(weather.description || weather.main || "Cloudy"),
    icon: mapOpenWeatherIcon(weather.main ?? "", weather.description ?? ""),
    latitude,
    longitude,
    fetchedAt: new Date().toISOString(),
    source: "openweather",
  };
}

async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo failed (${response.status})`);
  }

  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };

  const temperatureC = data.current?.temperature_2m;
  const code = data.current?.weather_code;
  if (temperatureC == null || !Number.isFinite(temperatureC) || code == null) {
    throw new Error("Open-Meteo returned incomplete data");
  }

  const mapped = mapOpenMeteo(code);

  return {
    temperatureC: Math.round(temperatureC),
    condition: mapped.condition,
    icon: mapped.icon,
    latitude,
    longitude,
    fetchedAt: new Date().toISOString(),
    source: "open-meteo",
  };
}

export async function fetchWeatherForCoordinates(
  latitude: number,
  longitude: number,
  options?: { forceRefresh?: boolean },
): Promise<{ weather: WeatherSnapshot | null; fromCache: boolean }> {
  const cached = await readCache(latitude, longitude);

  if (!options?.forceRefresh && cached && isFresh(cached)) {
    return { weather: cached, fromCache: true };
  }

  const openWeatherKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY?.trim();

  try {
    const weather = openWeatherKey
      ? await fetchOpenWeather(latitude, longitude, openWeatherKey)
      : await fetchOpenMeteo(latitude, longitude);

    await writeCache(weather);
    return { weather, fromCache: false };
  } catch (error) {
    console.log("[weather] fetch failed:", error);
    if (cached) {
      return { weather: cached, fromCache: true };
    }
    return { weather: null, fromCache: false };
  }
}

export async function resolveDeviceCoordinates(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  } catch (error) {
    console.log("[weather] device location failed:", error);
    return null;
  }
}

export function weatherIconColor(icon: WeatherIconName) {
  if (icon === "sun") {
    return "#FBBF24";
  }
  if (icon === "cloud-rain" || icon === "cloud-drizzle" || icon === "cloud-lightning") {
    return "#93C5FD";
  }
  if (icon === "cloud-snow") {
    return "#E2E8F0";
  }
  return "#E5E7EB";
}
