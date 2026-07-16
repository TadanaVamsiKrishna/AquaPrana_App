import { StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../context/aqua-chat-context";

const colors = {
  primary: "#0A84FF",
  white: "#FFFFFF",
  text: "#0B3A6E",
  border: "#E2E8F0",
  bubble: "#FFFFFF",
  shadow: "#0A4F9E",
};

export function AquaChatMessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={styles.userBubbleWrap}>
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantBlock}>
      <View style={styles.assistantLabelRow}>
        <View style={styles.assistantIcon}>
          <Feather name="cpu" size={12} color={colors.white} />
        </View>
        <Text style={styles.assistantLabel}>{t("aquagpt.assistantLabel")}</Text>
      </View>
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantBubbleText}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantBlock: { gap: 8, alignItems: "flex-start" },
  assistantLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  assistantIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  assistantBubble: {
    backgroundColor: colors.bubble,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: "94%",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  assistantBubbleText: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  userBubbleWrap: { alignItems: "flex-end" },
  userBubble: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: "86%",
  },
  userBubbleText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
