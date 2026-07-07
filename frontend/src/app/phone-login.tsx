import { useState } from "react";
//import { supabase } from "../lib/supabase";
import { sendOTP } from "../services/auth";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");

  const isValidPhoneNumber = phoneNumber.length === 10;

  const handlePhoneNumberChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(digitsOnly);
  };

  const handleContinue = async () => {

    if (!isValidPhoneNumber) {
      alert("Enter a valid phone number");
      return;
    }
  
    const fullPhone = `+91${phoneNumber}`;
  
    const { data, error } = await sendOTP(fullPhone);
  
    console.log("DATA:", data);
    console.log("ERROR:", error);
  
    if (error) {
      alert(error.message);
      return;
    }
  
    router.push({
      pathname: "/verify-otp",
      params: {
        phone: fullPhone,
      },
    });
  
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>AP</Text>
            </View>

            <Text style={styles.title}>Welcome to AquaPrana</Text>
            <Text style={styles.subtitle}>Enter your phone number to continue</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone number</Text>

              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCodeContainer}>
                  <Text style={styles.countryCode}>+91</Text>
                </View>

                <TextInput
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder="9876543210"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={10}
                  style={styles.input}
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  accessibilityLabel="Phone number"
                />
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleContinue}
            disabled={!isValidPhoneNumber}
            style={({ pressed }) => [
              styles.button,
              !isValidPhoneNumber && styles.buttonDisabled,
              pressed && isValidPhoneNumber && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValidPhoneNumber }}
          >
            <Text
              style={[
                styles.buttonText,
                !isValidPhoneNumber && styles.buttonTextDisabled,
              ]}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const colors = {
  white: "#FFFFFF",
  aquaBlue: "#0EA5E9",
  deepBlue: "#075985",
  softBlue: "#E0F2FE",
  borderBlue: "#BAE6FD",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  placeholder: "#94A3B8",
  disabled: "#E2E8F0",
  disabledText: "#94A3B8",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  content: {
    paddingTop: 56,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  brandMarkText: {
    color: colors.deepBlue,
    fontSize: 22,
    fontWeight: "800",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 36,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  phoneInputContainer: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderBlue,
    borderRadius: 14,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  countryCodeContainer: {
    height: "100%",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softBlue,
    borderRightWidth: 1,
    borderRightColor: colors.borderBlue,
  },
  countryCode: {
    color: colors.deepBlue,
    fontSize: 16,
    fontWeight: "800",
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  button: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.aquaBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  buttonTextDisabled: {
    color: colors.disabledText,
  },
});