import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#0A84FF",
  background: "#F4FAFF",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6E4F0",
  softBlue: "#EAF5FF",
  paleBlue: "#F8FCFF",
  success: "#22C55E",
  shadow: "#0A4F9E",
};

type JourneyOption = "new" | "existing";

type OptionConfig = {
  id: JourneyOption;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  features: string[];
};

const journeyOptions: OptionConfig[] = [
  {
    id: "new",
    title: "Start New Cycle",
    description: "Begin a new crop today.",
    icon: "calendar",
    features: ["Day 1 starts today", "Track the full cycle"],
  },
  {
    id: "existing",
    title: "Join Existing Cycle",
    description: "Your crop is already running.",
    icon: "rotate-cw",
    features: ["Add current pond status", "Continue from today"],
  },
];

function RadioButton({ selected }: { selected: boolean }) {
  return (
    <View
      style={[styles.radioOuter, selected && styles.radioOuterSelected]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

export default function StartJourneyScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();
  const [selectedOption, setSelectedOption] = useState<JourneyOption>("new");

  const handleContinue = () => {
    if (!pondId) {
      Alert.alert("Pond not found", "Please set up your pond again.");
      return;
    }

    if (selectedOption === "new") {
      router.push({
        pathname: "/crop-details",
        params: { pondId },
      } as never);
      return;
    }

    router.push({
      pathname: "/join-existing-cycle",
      params: { pondId },
    } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Start Your Journey</Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dropCircle}>
                <Feather name="droplet" size={16} color={colors.primary} />
              </View>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.subtitle}>Choose how to start.</Text>
          </View>

          <View
            style={styles.optionsBlock}
            accessibilityRole="radiogroup"
            accessibilityLabel="Journey options"
          >
            {journeyOptions.map((option) => {
              const isSelected = selectedOption === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedOption(option.id)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    pressed && styles.optionCardPressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.title}
                >
                  <View style={styles.optionTopRow}>
                    <View style={styles.optionIconCircle}>
                      <Feather
                        name={option.icon}
                        size={22}
                        color={colors.primary}
                      />
                      {option.id === "new" ? (
                        <View style={styles.plusBadge}>
                          <Feather name="plus" size={10} color={colors.white} />
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      <Text style={styles.optionDescription}>
                        {option.description}
                      </Text>
                    </View>

                    <RadioButton selected={isSelected} />
                  </View>

                  <View style={styles.featureList}>
                    {option.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Feather
                          name="check"
                          size={14}
                          color={colors.success}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.waveDecoration}>
            <View style={[styles.wave, styles.waveLeft]} />
            <View style={[styles.wave, styles.waveRight]} />
          </View>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 14,
  },
  dividerLine: {
    width: 72,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.32,
  },
  dropCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  optionsBlock: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.paleBlue,
    shadowOpacity: 0.1,
    elevation: 5,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    position: "relative",
  },
  plusBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  optionCopy: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  optionDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  featureList: {
    marginTop: 14,
    paddingLeft: 4,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginLeft: 10,
    flex: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
    backgroundColor: colors.background,
    position: "relative",
  },
  waveDecoration: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -18,
    height: 36,
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.softBlue,
    opacity: 0.55,
  },
  waveLeft: {
    left: -40,
    top: 8,
  },
  waveRight: {
    right: -50,
    top: 14,
  },
  continueButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 7,
  },
  continueButtonPressed: {
    opacity: 0.9,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
  },
});
