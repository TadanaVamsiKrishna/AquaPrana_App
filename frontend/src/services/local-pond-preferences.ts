import AsyncStorage from "@react-native-async-storage/async-storage";

export type PondDataSource = "iot" | "manual";

export type PondDataSourcePreference = {
  pondId: string;
  source: PondDataSource;
};

const DATA_SOURCE_KEY = "pond_data_sources";

export const getDataSourcePreferences = async (): Promise<
  PondDataSourcePreference[]
> => {
  const raw = await AsyncStorage.getItem(DATA_SOURCE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PondDataSourcePreference[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getDataSourceForPond = async (
  pondId: string,
): Promise<PondDataSource | null> => {
  const preferences = await getDataSourcePreferences();
  return preferences.find((item) => item.pondId === pondId)?.source ?? null;
};

export const saveDataSourceForPond = async (
  pondId: string,
  source: PondDataSource,
) => {
  const preferences = await getDataSourcePreferences();
  const existingIndex = preferences.findIndex((item) => item.pondId === pondId);
  const nextPreference: PondDataSourcePreference = { pondId, source };
  const nextPreferences =
    existingIndex >= 0
      ? preferences.map((item, index) =>
          index === existingIndex ? nextPreference : item,
        )
      : [...preferences, nextPreference];

  await AsyncStorage.setItem(DATA_SOURCE_KEY, JSON.stringify(nextPreferences));
};
