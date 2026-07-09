import AsyncStorage from "@react-native-async-storage/async-storage";

export type FarmerProfile = {
  name: string;
  state: string;
  district: string;
  language: string;
};

const PROFILE_KEY = "farmer_profile";

export const saveFarmerProfile = async (profile: FarmerProfile) => {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const getFarmerProfile = async (): Promise<FarmerProfile | null> => {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FarmerProfile;
  } catch {
    return null;
  }
};

export const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
};
