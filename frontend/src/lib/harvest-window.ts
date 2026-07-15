import {
  CUSTOM_SPECIES,
  SPECIES_DURATION_MAP,
  type SpeciesDuration,
} from "../constants/crop-species";

export type HarvestWindowDates = {
  earliest: Date;
  latest: Date;
};

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDisplayDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export const formatIsoDateForDisplay = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);

  if (!year || !month || !day) {
    return isoDate;
  }

  return formatDisplayDate(new Date(year, month - 1, day));
};

export const formatHarvestWindowRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  const startValue = start?.trim();
  const endValue = end?.trim();

  if (!startValue || !endValue) {
    return "Harvest window pending";
  }

  const startDisplay = /^\d{4}-\d{2}-\d{2}$/.test(startValue)
    ? formatIsoDateForDisplay(startValue)
    : startValue;
  const endDisplay = /^\d{4}-\d{2}-\d{2}$/.test(endValue)
    ? formatIsoDateForDisplay(endValue)
    : endValue;

  return `${startDisplay} - ${endDisplay}`;
};

export const getSpeciesDuration = (
  species: string,
): SpeciesDuration | null => {
  if (!species || species === CUSTOM_SPECIES) {
    return null;
  }

  return SPECIES_DURATION_MAP[species] ?? null;
};

export const calculateHarvestWindow = (
  stockingDate: Date,
  species: string,
): HarvestWindowDates | null => {
  const duration = getSpeciesDuration(species);

  if (!duration) {
    return null;
  }

  return {
    earliest: addDays(stockingDate, duration.minDays),
    latest: addDays(stockingDate, duration.maxDays),
  };
};

export type HarvestWindowDisplay =
  | {
      mode: "placeholder";
      message: string;
    }
  | {
      mode: "calculated";
      earliest: string;
      latest: string;
    }
  | {
      mode: "manual";
      message: string;
      earliest: string | null;
      latest: string | null;
    };

export const getHarvestWindowDisplay = ({
  species,
  stockingDate,
  manualEarliest,
  manualLatest,
}: {
  species: string;
  stockingDate: Date | null;
  manualEarliest: Date | null;
  manualLatest: Date | null;
}): HarvestWindowDisplay => {
  if (!species || !stockingDate) {
    return {
      mode: "placeholder",
      message: "Select species and stocking date",
    };
  }

  if (species === CUSTOM_SPECIES) {
    return {
      mode: "manual",
      message: "Enter expected harvest date manually",
      earliest: manualEarliest ? formatDisplayDate(manualEarliest) : null,
      latest: manualLatest ? formatDisplayDate(manualLatest) : null,
    };
  }

  const harvestWindow = calculateHarvestWindow(stockingDate, species);

  if (!harvestWindow) {
    return {
      mode: "placeholder",
      message: "Select species and stocking date",
    };
  }

  return {
    mode: "calculated",
    earliest: formatDisplayDate(harvestWindow.earliest),
    latest: formatDisplayDate(harvestWindow.latest),
  };
};
