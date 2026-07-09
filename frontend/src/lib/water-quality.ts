export type ParameterStatus = "good" | "attention" | "critical" | "none";

export type WaterParameterKey =
  | "do"
  | "ph"
  | "ammonia"
  | "temperature"
  | "salinity"
  | "calcium"
  | "magnesium"
  | "potassium";

export type ParameterReading = {
  key: WaterParameterKey;
  label: string;
  unit: string;
  value: number | null;
  safeRange: string;
};

const statusColors = {
  good: "#16A34A",
  attention: "#0A84FF",
  critical: "#EF4444",
  none: "#94A3B8",
};

const statusBackgrounds = {
  good: "#DCFCE7",
  attention: "#DBEAFE",
  critical: "#FEE2E2",
  none: "#F1F5F9",
};

export const getStatusColor = (status: ParameterStatus) => statusColors[status];
export const getStatusBackground = (status: ParameterStatus) =>
  statusBackgrounds[status];

export const getDoStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value >= 4 && value <= 10) {
    return "good";
  }

  if (value >= 3 && value < 4) {
    return "attention";
  }

  if (value > 10 && value <= 12) {
    return "attention";
  }

  return "critical";
};

export const getPhStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value >= 7.5 && value <= 8.5) {
    return "good";
  }

  if ((value >= 7.0 && value < 7.5) || (value > 8.5 && value <= 9.0)) {
    return "attention";
  }

  return "critical";
};

export const getAmmoniaStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value < 0.1) {
    return "good";
  }

  if (value <= 0.3) {
    return "attention";
  }

  return "critical";
};

export const getTemperatureStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value >= 28 && value <= 32) {
    return "good";
  }

  if ((value >= 24 && value < 28) || (value > 32 && value <= 34)) {
    return "attention";
  }

  return "critical";
};

export const getSalinityStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value >= 10 && value <= 25) {
    return "good";
  }

  if ((value >= 5 && value < 10) || (value > 25 && value <= 30)) {
    return "attention";
  }

  return "critical";
};

export const getCalciumStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value > 75) {
    return "good";
  }

  if (value >= 50) {
    return "attention";
  }

  return "critical";
};

export const getMagnesiumStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value > 100) {
    return "good";
  }

  if (value >= 75) {
    return "attention";
  }

  return "critical";
};

export const getPotassiumStatus = (value: number | null): ParameterStatus => {
  if (value === null || Number.isNaN(value)) {
    return "none";
  }

  if (value > 5) {
    return "good";
  }

  if (value >= 3) {
    return "attention";
  }

  return "critical";
};

export const getParameterStatus = (
  key: WaterParameterKey,
  value: number | null,
): ParameterStatus => {
  switch (key) {
    case "do":
      return getDoStatus(value);
    case "ph":
      return getPhStatus(value);
    case "ammonia":
      return getAmmoniaStatus(value);
    case "temperature":
      return getTemperatureStatus(value);
    case "salinity":
      return getSalinityStatus(value);
    case "calcium":
      return getCalciumStatus(value);
    case "magnesium":
      return getMagnesiumStatus(value);
    case "potassium":
      return getPotassiumStatus(value);
    default:
      return "none";
  }
};

export type OverallWaterQuality = "Good" | "Attention" | "Critical" | "Not logged";

export const getOverallWaterQuality = (
  readings: Partial<Record<WaterParameterKey, number | null>>,
): OverallWaterQuality => {
  const statuses = (Object.keys(readings) as WaterParameterKey[])
    .map((key) => getParameterStatus(key, readings[key] ?? null))
    .filter((status) => status !== "none");

  if (statuses.length === 0) {
    return "Not logged";
  }

  if (statuses.some((status) => status === "critical")) {
    return "Critical";
  }

  if (statuses.some((status) => status === "attention")) {
    return "Attention";
  }

  return "Good";
};

export const getOverallStatusColor = (quality: OverallWaterQuality) => {
  if (quality === "Good") {
    return statusColors.good;
  }

  if (quality === "Attention") {
    return "#F59E0B";
  }

  if (quality === "Critical") {
    return statusColors.critical;
  }

  return statusColors.none;
};

export const getPondHealthColor = (quality: OverallWaterQuality) => {
  if (quality === "Good") {
    return "#22C55E";
  }

  if (quality === "Attention") {
    return "#F59E0B";
  }

  if (quality === "Critical") {
    return "#EF4444";
  }

  return "#94A3B8";
};

export const getSurvivalColor = (survivalRate: string) => {
  const value = Number.parseFloat(survivalRate);

  if (!Number.isFinite(value)) {
    return statusColors.none;
  }

  if (value >= 85) {
    return statusColors.good;
  }

  if (value >= 70) {
    return "#F59E0B";
  }

  return statusColors.critical;
};

export const WATER_PARAMETERS: {
  key: WaterParameterKey;
  label: string;
  unit: string;
  safeRange: string;
}[] = [
  { key: "do", label: "DO (mg/L)", unit: "mg/L", safeRange: "4–10" },
  { key: "ph", label: "pH", unit: "", safeRange: "7.5–8.5" },
  { key: "temperature", label: "Temp (°C)", unit: "°C", safeRange: "28–32" },
  { key: "salinity", label: "Salinity (ppt)", unit: "ppt", safeRange: "10–25" },
  { key: "ammonia", label: "Ammonia (mg/L)", unit: "mg/L", safeRange: "0–0.1" },
  { key: "calcium", label: "Ca (mg/L)", unit: "mg/L", safeRange: "> 75" },
  { key: "magnesium", label: "Mg (mg/L)", unit: "mg/L", safeRange: "> 100" },
  { key: "potassium", label: "K (mg/L)", unit: "mg/L", safeRange: "> 5" },
];
