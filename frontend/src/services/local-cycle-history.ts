import AsyncStorage from "@react-native-async-storage/async-storage";

export type CycleOutcome = "Successful" | "Failed";

export type ClosedCycle = {
  id: string;
  pondId: string;
  pondName: string;
  species: string;
  stockingDate: string;
  harvestDate: string;
  cycleLengthDays: string;
  outcome: CycleOutcome;
  harvestWeightKg: string;
  failureReason?: string;
  finalFcr: string;
  finalSurvival: string;
  closedAt: string;
};

const CYCLE_HISTORY_KEY = "pond_cycle_history";

export const getClosedCycles = async (): Promise<ClosedCycle[]> => {
  const raw = await AsyncStorage.getItem(CYCLE_HISTORY_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ClosedCycle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getClosedCyclesForPond = async (
  pondId: string,
): Promise<ClosedCycle[]> => {
  const cycles = await getClosedCycles();
  return cycles
    .filter((cycle) => cycle.pondId === pondId)
    .sort(
      (left, right) =>
        new Date(right.closedAt).getTime() - new Date(left.closedAt).getTime(),
    );
};

export const saveClosedCycle = async (cycle: ClosedCycle) => {
  const cycles = await getClosedCycles();
  await AsyncStorage.setItem(
    CYCLE_HISTORY_KEY,
    JSON.stringify([cycle, ...cycles]),
  );
};
