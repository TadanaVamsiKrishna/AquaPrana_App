import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../context/aqua-chat-context";

const colors = {
  primary: "#0A84FF",
  white: "#FFFFFF",
  text: "#0B1F3A",
  textDark: "#111827",
  muted: "#6B7280",
  border: "#E2E8F0",
  bubble: "#FFFFFF",
  shadow: "#0A4F9E",
  softBlue: "#E8F3FF",
};

function UserAttachmentContent({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const imageUri = message.localUri ?? message.fileUrl;
  const isImage =
    message.messageType === "image" ||
    message.mimeType?.startsWith("image/") === true;

  if (isImage && imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={styles.imagePreview}
        contentFit="cover"
      />
    );
  }

  if (isImage) {
    return (
      <View style={styles.imagePlaceholder}>
        <Feather name="image" size={24} color={colors.white} />
        <Text style={styles.imagePlaceholderText}>
          {message.fileName ?? "Image"}
        </Text>
      </View>
    );
  }

  if (message.messageType === "document") {
    const openUri = message.fileUrl ?? message.localUri;
    return (
      <Pressable
        onPress={() => {
          if (openUri) {
            void Linking.openURL(openUri);
          }
        }}
        style={styles.documentBubble}
      >
        <View style={styles.documentIcon}>
          <Feather name="file-text" size={18} color={colors.primary} />
        </View>
        <View style={styles.documentCopy}>
          <Text style={styles.documentName} numberOfLines={2}>
            {message.fileName ?? t("aquagpt.document")}
          </Text>
          <Text style={styles.documentMeta}>{t("aquagpt.tapToOpen")}</Text>
        </View>
      </Pressable>
    );
  }

  if (message.messageType === "audio") {
    return (
      <View style={styles.audioBubble}>
        <View style={styles.audioIcon}>
          <Feather name="mic" size={16} color={colors.primary} />
        </View>
        <View style={styles.audioCopy}>
          <Text style={styles.audioLabel}>{t("aquagpt.voiceNote")}</Text>
          <Text style={styles.userBubbleText}>
            {message.transcript?.trim() || message.text}
          </Text>
        </View>
      </View>
    );
  }

  return <Text style={styles.userBubbleText}>{message.text}</Text>;
}

export function AquaChatMessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const isImageOnly =
    isUser &&
    (message.messageType === "image" ||
      message.mimeType?.startsWith("image/") === true);

  if (isUser) {
    return (
      <View style={styles.userBubbleWrap}>
        <View style={[styles.userBubble, isImageOnly && styles.userImageBubble]}>
          <UserAttachmentContent message={message} />
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
    color: colors.textDark,
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
  userImageBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: "hidden",
  },
  userBubbleText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  attachmentBlock: { gap: 8 },
  imagePreview: {
    width: 220,
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
  },
  imagePlaceholder: {
    width: 220,
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  imagePlaceholderText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  documentBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 180,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  documentCopy: { flex: 1, gap: 2 },
  documentName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  documentMeta: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  audioBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minWidth: 180,
  },
  audioIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  audioCopy: { flex: 1, gap: 4 },
  audioLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
