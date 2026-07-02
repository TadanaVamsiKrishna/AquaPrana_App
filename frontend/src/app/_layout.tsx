import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="phone-login" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="farmer-profile" />
    </Stack>
  );
}