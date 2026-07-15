export type WaterQualityMetric = {
  label: string;
  min: number | null;
  max: number | null;
  avg: number | null;
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const collectNumeric = (
  rows: Record<string, unknown>[],
  key: string,
): number[] =>
  rows
    .map((row) => {
      const value = row[key];
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value != null);

export const buildWaterQualityMetrics = (
  logs: Record<string, unknown>[],
): WaterQualityMetric[] => {
  const definitions = [
    { label: "DO (mg/L)", key: "do_mgl" },
    { label: "pH", key: "ph" },
    { label: "Temp (C)", key: "temp_c" },    { label: "Salinity (ppt)", key: "salinity_ppt" },
    { label: "Ammonia (mg/L)", key: "ammonia_mgl" },
    { label: "Calcium (mg/L)", key: "calcium_mgl" },
    { label: "Magnesium (mg/L)", key: "magnesium_mgl" },
    { label: "Potassium (mg/L)", key: "potassium_mgl" },
  ];

  return definitions.map(({ label, key }) => {
    const values = collectNumeric(logs, key);

    return {
      label,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      avg: average(values),
    };
  });
};

export const getCycleDurationDays = (cycle: Record<string, unknown>) => {
  if (cycle.days_of_culture != null && Number.isFinite(Number(cycle.days_of_culture))) {
    return Math.max(1, Number(cycle.days_of_culture));
  }

  const stockingDate = cycle.stocking_date ? String(cycle.stocking_date) : null;
  if (!stockingDate) {
    return null;
  }

  const start = Date.parse(`${stockingDate}T00:00:00`);
  if (!Number.isFinite(start)) {
    return null;
  }

  const endValue = cycle.actual_harvest_date ?? cycle.closed_at ?? new Date().toISOString();
  const end = Date.parse(String(endValue).includes("T") ? String(endValue) : `${endValue}T00:00:00`);

  if (!Number.isFinite(end)) {
    return null;
  }

  return Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
};
