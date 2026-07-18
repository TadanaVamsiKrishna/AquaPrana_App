import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { verifyOTP } from "../services/auth";
import {
  farmerExistsForPhone,
  getCurrentUserProfile,
  restoreSoftDeletedAccountIfNeeded,
} from "../services/profile";
import { saveFarmerProfile } from "../services/local-profile";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const colors = {
  primaryBlue: "#0A84FF",
  background: "#F8FCFF",
  text: "#1F2937",
  border: "#D6E4F0",
  white: "#FFFFFF",
  mutedText: "#6B7280",
  lightBlue: "#EAF5FF",
  disabled: "#B9D8F5",
};

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{
    phone: string;
  }>();
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);

  const isOtpValid = otp.length === 6;
  const isResendDisabled = resendSeconds > 0;
  const isVerifyDisabled = !isOtpValid || isVerifying;

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleOtpChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digitsOnly);
  };

  const handleVerifyOtp = async () => {
    if (!isOtpValid || isVerifying) {
      return;
    }

    setIsVerifying(true);

    try {
      const { error } = await verifyOTP(phone as string, otp);

      if (error) {
        alert(error.message);
        return;
      }

      // Soft-delete restore only. On failure/skip, existing OTP flow continues as-is.
      const restoreResult = await restoreSoftDeletedAccountIfNeeded(
        phone as string,
      );
      if (restoreResult.restored && restoreResult.profile) {
        await saveFarmerProfile({
          name: restoreResult.profile.name,
          state: restoreResult.profile.state ?? "",
          district: restoreResult.profile.district ?? "",
          language: restoreResult.profile.language ?? "",
        });
        Alert.alert(
          t("profile.accountRestoredTitle"),
          t("profile.accountRestoredMessage"),
        );
        router.replace("/home" as never);
        return;
      }

      const {
        exists: phoneExists,
        profile: phoneProfile,
        error: phoneLookupError,
      } = await farmerExistsForPhone(phone as string);

      if (phoneLookupError) {
        alert(phoneLookupError.message);
        return;
      }

      if (phoneExists && phoneProfile) {
        await saveFarmerProfile({
          name: phoneProfile.name,
          state: phoneProfile.state ?? "",
          district: phoneProfile.district ?? "",
          language: phoneProfile.language ?? "",
        });
        router.replace("/home" as never);
        return;
      }

      const { profile: userProfile, error: userProfileError } =
        await getCurrentUserProfile();

      if (userProfileError) {
        alert(userProfileError.message);
        return;
      }

      if (userProfile?.name) {
        await saveFarmerProfile({
          name: userProfile.name,
          state: userProfile.state ?? "",
          district: userProfile.district ?? "",
          language: userProfile.language ?? "",
        });
        router.replace("/home" as never);
        return;
      }

      router.replace("/farmer-profile" as never);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = () => {
    if (isResendDisabled) {
      return;
    }

    setOtp("");
    setResendSeconds(30);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View>
            <Text style={styles.header}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              We have sent a 6-digit verification code to your registered mobile
              number.
            </Text>

            <View style={styles.phoneCard}>
              <Text style={styles.phoneLabel}>Mobile number</Text>
              <Text style={styles.phoneNumber}>
                {phone || "No phone number"}
              </Text>
            </View>

            <View style={styles.otpCard}>
              <Text style={styles.inputLabel}>Enter verification code</Text>

              <TextInput
                value={otp}
                onChangeText={handleOtpChange}
                autoFocus
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.mutedText}
                style={styles.otpInput}
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                accessibilityLabel="OTP verification code"
              />

              <Pressable
                onPress={handleVerifyOtp}
                disabled={isVerifyDisabled}
                style={({ pressed }) => [
                  styles.verifyButton,
                  isVerifyDisabled && styles.buttonDisabled,
                  pressed && isOtpValid && !isVerifying && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: isVerifyDisabled }}
              >
                {isVerifying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify OTP</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendPrompt}>Didn't receive the code?</Text>

            <Pressable
              onPress={handleResendOtp}
              disabled={isResendDisabled}
              style={styles.resendButton}
              accessibilityRole="button"
              accessibilityState={{ disabled: isResendDisabled }}
            >
              <Text
                style={[
                  styles.resendButtonText,
                  isResendDisabled && styles.resendButtonTextDisabled,
                ]}
              >
                {isResendDisabled ? `Resend in ${resendSeconds}s` : "Resend OTP"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
  },
  header: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 40,
    marginBottom: 12,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },
  phoneCard: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  phoneLabel: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  phoneNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  otpCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    shadowColor: "#0A84FF",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  otpInput: {
    height: 58,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    paddingHorizontal: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  verifyButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  resendContainer: {
    alignItems: "center",
  },
  resendPrompt: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
  },
  resendButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  resendButtonText: {
    color: colors.primaryBlue,
    fontSize: 16,
    fontWeight: "800",
  },
  resendButtonTextDisabled: {
    color: colors.mutedText,
  },
});
