import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import {
  useFocusEffect,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AquaChatMessageBubble } from "../components/aqua-chat-message";
import { AquaChatHistoryDrawer } from "../components/aqua-chat-history-drawer";
import { BottomNav } from "../components/bottom-nav";
import {
  GENERIC_ASSISTANT_ID,
  GENERIC_ASSISTANT_LABEL,
  useAquaChat,
  type ChatMessage,
} from "../context/aqua-chat-context";
import { resolvePondId } from "../lib/pond-route";
import { getLogsForPond } from "../services/dailyLogs";
import type { AquaGPTRequestContext } from "../services/aquagpt";
import { getFarmerProfile } from "../services/local-profile";
import { getCurrentUserProfile } from "../services/profile";

const colors = {
  primary: "#0A84FF",
  background: "#F7FAFC",
  white: "#FFFFFF",
  textDark: "#1F2937",
  muted: "#6B7280",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  suggestion: "#EEF2F7",
  warningSoft: "#F3F4F6",
};

function getDaysSince(dateString?: string | null) {
  if (!dateString) {
    return null;
  }

  const observed = new Date(dateString);
  if (Number.isNaN(observed.getTime())) {
    return null;
  }

  const diffMs = Date.now() - observed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function AquaGptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    pondId?: string | string[];
    cycleId?: string | string[];
  }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [pondPickerOpen, setPondPickerOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [staleLogDays, setStaleLogDays] = useState<number | null>(null);
  const [profileInitial, setProfileInitial] = useState("G");

  const {
    messages,
    draft,
    isSending,
    isUploading,
    isRecording,
    isLoadingMessages,
    ponds,
    selectedPondId,
    selectedPondName,
    isGenericMode,
    setDraft,
    setSelectedPondId,
    sendQuestion,
    sendImageAttachment,
    sendDocumentAttachment,
    startAudioRecording,
    stopAudioRecordingAndSend,
    refreshPonds,
  } = useAquaChat();

  const routePondId = resolvePondId(params.pondId);
  const routeCycleId = resolvePondId(params.cycleId);

  const requestContext = useMemo<AquaGPTRequestContext>(
    () => ({
      pondId: isGenericMode ? null : selectedPondId ?? routePondId ?? null,
      cycleId: isGenericMode ? null : routeCycleId,
      screen: pathname || "/aqua-gpt",
      mode: isGenericMode ? "generic" : "pond",
    }),
    [
      isGenericMode,
      selectedPondId,
      routePondId,
      routeCycleId,
      pathname,
    ],
  );

  const suggestionQuestions = useMemo(
    () => [
      t("aquagpt.suggestions.ammonia"),
      t("aquagpt.suggestions.harvest"),
      t("aquagpt.suggestions.fcr"),
      t("aquagpt.suggestions.survival"),
      t("aquagpt.suggestions.quality"),
      t("aquagpt.suggestions.feed"),
    ],
    [t],
  );

  const loadStaleLogBanner = useCallback(async () => {
    if (isGenericMode || !selectedPondId || selectedPondId === GENERIC_ASSISTANT_ID) {
      setStaleLogDays(null);
      return;
    }

    try {
      const logs = await getLogsForPond(selectedPondId);
      const latest = logs[0];
      const days = getDaysSince(latest?.observedAt);
      setStaleLogDays(days != null && days > 0 ? days : null);
    } catch {
      setStaleLogDays(null);
    }
  }, [isGenericMode, selectedPondId]);

  const loadProfileAvatar = useCallback(async () => {
    const [localProfile, remoteResult] = await Promise.all([
      getFarmerProfile(),
      getCurrentUserProfile(),
    ]);

    const name =
      remoteResult.profile?.name?.trim() ||
      localProfile?.name?.trim() ||
      "";
    const initial = name.charAt(0).toUpperCase() || "G";
    setProfileInitial(initial);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPonds();
      if (routePondId) {
        setSelectedPondId(routePondId);
      }
      void loadStaleLogBanner();
      void loadProfileAvatar();
    }, [
      refreshPonds,
      routePondId,
      setSelectedPondId,
      loadStaleLogBanner,
      loadProfileAvatar,
    ]),
  );

  useEffect(() => {
    void loadStaleLogBanner();
  }, [loadStaleLogBanner]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = (question: string) => {
    void sendQuestion(question, requestContext);
  };

  const handleMicPress = () => {
    if (isRecording) {
      void stopAudioRecordingAndSend(requestContext);
      return;
    }

    void startAudioRecording();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home" as never);
  };

  const placeholder = isGenericMode
    ? t("aquagpt.askGeneral")
    : t("aquagpt.askPondNamed", {
        pond: selectedPondName ?? t("aquagpt.selectPondFallback"),
      });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Feather name="arrow-left" size={22} color={colors.primary} />
            </Pressable>

            <Pressable
              onPress={() => setPondPickerOpen(true)}
              style={({ pressed }) => [
                styles.headerCenter,
                styles.pondSelector,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("aquagpt.selectPond")}
            >
              <Text style={styles.pondSelectorText} numberOfLines={1}>
                {selectedPondName ?? t("aquagpt.selectPondFallback")}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.primary} />
            </Pressable>

            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setHistoryOpen(true)}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("aquagpt.history")}
              >
                <Feather name="clock" size={20} color={colors.textDark} />
              </Pressable>

              <Pressable
                onPress={() => router.push("/edit-profile" as never)}
                style={({ pressed }) => [
                  styles.profileAvatar,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("profile.title")}
              >
                <Text style={styles.profileAvatarText}>{profileInitial}</Text>
              </Pressable>
            </View>
          </View>

          {staleLogDays != null ? (
            <View style={styles.staleBanner}>
              <Text style={styles.staleBannerText}>
                {t("aquagpt.staleLogBanner", { days: staleLogDays })}
              </Text>
            </View>
          ) : null}

          {isLoadingMessages ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.dateBadgeWrap}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{t("aquagpt.today")}</Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => <AquaChatMessageBubble message={item} />}
            />
          )}

          <View style={styles.composerArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
            >
              {suggestionQuestions.map((question) => (
                <Pressable
                  key={question}
                  onPress={() => handleSend(question)}
                  disabled={isSending || isUploading}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <View style={styles.attachWrap}>
                <Pressable
                  onPress={() => setAttachmentMenuOpen((open) => !open)}
                  disabled={isSending || isUploading}
                  style={({ pressed }) => [
                    styles.attachButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("aquagpt.attach")}
                >
                  <Feather name="paperclip" size={20} color={colors.muted} />
                </Pressable>

                {attachmentMenuOpen ? (
                  <View style={styles.attachMenu}>
                    <Pressable
                      onPress={() => {
                        setAttachmentMenuOpen(false);
                        void sendImageAttachment(requestContext);
                      }}
                      style={styles.attachMenuItem}
                    >
                      <Feather name="image" size={16} color={colors.textDark} />
                      <Text style={styles.attachMenuText}>
                        {t("aquagpt.addImage")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setAttachmentMenuOpen(false);
                        void sendDocumentAttachment(requestContext);
                      }}
                      style={styles.attachMenuItem}
                    >
                      <Feather name="file" size={16} color={colors.textDark} />
                      <Text style={styles.attachMenuText}>
                        {t("aquagpt.addFile")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.inputShell}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  editable={!isSending && !isUploading && !isRecording}
                  returnKeyType="send"
                  onSubmitEditing={() => handleSend(draft)}
                />
                <Pressable
                  onPress={handleMicPress}
                  disabled={isSending || isUploading}
                  style={({ pressed }) => [
                    styles.micButton,
                    isRecording && styles.micButtonActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isRecording ? t("aquagpt.stopRecording") : t("aquagpt.recordAudio")
                  }
                >
                  <Feather
                    name="mic"
                    size={18}
                    color={isRecording ? colors.white : colors.muted}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={() => handleSend(draft)}
                disabled={isSending || isUploading || isRecording || !draft.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (isSending || isUploading || isRecording || !draft.trim()) &&
                    styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("aquagpt.send")}
              >
                {isSending || isUploading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Feather name="send" size={18} color={colors.white} />
                )}
              </Pressable>
            </View>

            {isRecording ? (
              <Text style={styles.recordingHint}>{t("aquagpt.recordingHint")}</Text>
            ) : null}
          </View>

          <BottomNav activeTab="aquagpt" />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={pondPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPondPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPondPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("aquagpt.selectPond")}</Text>

            <Pressable
              onPress={() => {
                setSelectedPondId(GENERIC_ASSISTANT_ID);
                setPondPickerOpen(false);
              }}
              style={[styles.modalOption, isGenericMode && styles.modalOptionSelected]}
              accessibilityRole="button"
              accessibilityLabel={GENERIC_ASSISTANT_LABEL}
            >
              <View style={styles.modalOptionCopy}>
                <Text
                  style={[
                    styles.modalOptionText,
                    isGenericMode && styles.modalOptionTextSelected,
                  ]}
                >
                  {t("aquagpt.genericAssistant")}
                </Text>
                <Text style={styles.modalOptionMeta}>
                  {t("aquagpt.genericDescription")}
                </Text>
              </View>
              {isGenericMode ? (
                <Feather name="check" size={18} color={colors.primary} />
              ) : null}
            </Pressable>

            {ponds.length === 0 ? (
              <Text style={styles.emptyPondsText}>
                {t("aquagpt.genericEmptyDescription")}
              </Text>
            ) : (
              ponds.map((pond) => {
                const isSelected = pond.id === selectedPondId;
                return (
                  <Pressable
                    key={pond.id}
                    onPress={() => {
                      setSelectedPondId(pond.id);
                      setPondPickerOpen(false);
                    }}
                    style={[
                      styles.modalOption,
                      isSelected && styles.modalOptionSelected,
                    ]}
                  >
                    <View style={styles.modalOptionCopy}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {pond.pondName}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </Pressable>
      </Modal>

      <AquaChatHistoryDrawer
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        pondName={
          selectedPondName ?? t("aquagpt.selectPondFallback")
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pondSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  pondSelectorText: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    maxWidth: "85%",
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  staleBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.warningSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  staleBannerText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  dateBadgeWrap: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  dateBadge: {
    backgroundColor: colors.suggestion,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dateBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  composerArea: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
  },
  suggestionsRow: { gap: 8, paddingHorizontal: 4 },
  suggestionChip: {
    backgroundColor: colors.suggestion,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionText: { color: colors.textDark, fontSize: 13, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  attachWrap: { position: "relative" },
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  attachMenu: {
    position: "absolute",
    left: 0,
    bottom: 48,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 20,
  },
  attachMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachMenuText: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "700",
  },
  inputShell: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: colors.primary,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.55 },
  recordingHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  pressed: { opacity: 0.88 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    maxHeight: "70%",
  },
  modalTitle: {
    color: colors.textDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyPondsText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    paddingVertical: 12,
  },
  modalOption: {
    minHeight: 54,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalOptionSelected: { backgroundColor: colors.softBlue },
  modalOptionCopy: { flex: 1 },
  modalOptionText: { color: colors.textDark, fontSize: 15, fontWeight: "700" },
  modalOptionTextSelected: { color: colors.primary },
  modalOptionMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
});
