
import { useEffect } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  royalBlue: "#0646A8",
  deepBlue: "#033B8E",
  oceanBlue: "#0879D9",
  aquaBlue: "#20B7E8",
  lightAqua: "#7DE3F4",
  white: "#FFFFFF",
  softWhite: "#EAF8FF",
  glassWhite: "rgba(255, 255, 255, 0.18)",
  logoGlass: "rgba(255, 255, 255, 0.22)",
  shadowBlue: "#003B7A",
};

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/phone-login" as never);
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.royalBlue} />

      <View style={styles.background} pointerEvents="none">
        <View style={styles.topLayer} />
        <View style={styles.middleLayer} />
        <View style={styles.bottomLayer} />

        <View style={[styles.glowCircle, styles.glowCircleTop]} />
        <View style={[styles.glowCircle, styles.glowCircleMiddle]} />
        <View style={[styles.glowCircle, styles.glowCircleBottom]} />

        <View style={[styles.wave, styles.waveOne]} />
        <View style={[styles.wave, styles.waveTwo]} />
        <View style={[styles.wave, styles.waveThree]} />
      </View>

      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.logoCard}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🦐</Text>
            </View>
          </View>

          <Text style={styles.appName}>AQUAPRANA</Text>
          <Text style={styles.tagline}>TRACK. GROW. THRIVE.</Text>
        </View>

        <View style={styles.loadingDots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotMuted]} />
          <View style={[styles.dot, styles.dotSoft]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.royalBlue,
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  topLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "38%",
    backgroundColor: colors.royalBlue,
  },
  middleLayer: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: colors.oceanBlue,
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
  },
  bottomLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    backgroundColor: colors.aquaBlue,
    borderTopLeftRadius: 130,
    borderTopRightRadius: 130,
  },
  glowCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.glassWhite,
  },
  glowCircleTop: {
    width: 230,
    height: 230,
    top: -72,
    right: -82,
  },
  glowCircleMiddle: {
    width: 170,
    height: 170,
    top: "28%",
    left: -74,
    opacity: 0.55,
  },
  glowCircleBottom: {
    width: 260,
    height: 260,
    right: -118,
    bottom: -86,
    opacity: 0.38,
  },
  wave: {
    position: "absolute",
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.glassWhite,
  },
  waveOne: {
    width: 210,
    top: "62%",
    left: -36,
    transform: [{ rotate: "-8deg" }],
    opacity: 0.42,
  },
  waveTwo: {
    width: 260,
    top: "68%",
    right: -64,
    transform: [{ rotate: "-8deg" }],
    opacity: 0.34,
  },
  waveThree: {
    width: 160,
    top: "75%",
    left: 88,
    transform: [{ rotate: "-8deg" }],
    opacity: 0.28,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  centerContent: {
    alignItems: "center",
    marginBottom: 58,
  },
  logoCard: {
    width: 148,
    height: 148,
    borderRadius: 34,
    backgroundColor: colors.logoGlass,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadowBlue,
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 10,
  },
  iconCircle: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: colors.softWhite,
  },
  iconText: {
    fontSize: 42,
    lineHeight: 52,
  },
  appName: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 32,
  },
  tagline: {
    color: colors.softWhite,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 10,
  },
  loadingDots: {
    position: "absolute",
    bottom: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  dotMuted: {
    opacity: 0.7,
  },
  dotSoft: {
    opacity: 0.45,
  },
});