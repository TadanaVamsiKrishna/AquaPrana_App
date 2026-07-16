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
import { BottomNav } from "../components/bottom-nav";
import {
  GENERIC_ASSISTANT_ID,
  GENERIC_ASSISTANT_LABEL,
  useAquaChat,
  type ChatMessage,
} from "../context/aqua-chat-context";
import { resolvePondId } from "../lib/pond-route";

const colors = {
  primary: "#0A84FF",
  background: "#F7FAFC",
  white: "#FFFFFF",
  textDark: "#1F2937",
  muted: "#6B7280",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  suggestion: "#EEF2F7",
};

export default function AquaGptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ pondId?: string | string[]; cycleId?: string | string[] }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [pondPickerOpen, setPondPickerOpen] = useState(false);

  const {
    messages,
    draft,
    isSending,
    ponds,
    selectedPondId,
    selectedPondName,
    isGenericMode,
    setDraft,
    setSelectedPondId,
    sendQuestion,
    refreshPonds,
  } = useAquaChat();

  const routePondId = resolvePondId(params.pondId);
  const routeCycleId = resolvePondId(params.cycleId);

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

  useFocusEffect(
    useCallback(() => {
      void refreshPonds();
      if (routePondId) {
        setSelectedPondId(routePondId);
      }
    }, [refreshPonds, routePondId, setSelectedPondId]),
  );

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = (question: string) => {
    void sendQuestion(question, {
      pondId: isGenericMode ? null : selectedPondId ?? routePondId ?? null,
      cycleId: isGenericMode ? null : routeCycleId,
      screen: pathname || "/aqua-gpt",
      mode: isGenericMode ? "generic" : "pond",
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home" as never);
  };

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
              style={({ pressed }) => [styles.pondSelector, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("aquagpt.selectPond")}
            >
              <View style={styles.headerIcon}>
                <Feather name="cpu" size={14} color={colors.white} />
              </View>
              <View style={styles.pondSelectorCopy}>
                <Text style={styles.headerTitle}>{t("aquagpt.title")}</Text>
                <Text style={styles.pondSelectorText} numberOfLines={1}>
                  {selectedPondName ?? t("aquagpt.selectPondFallback")}
                </Text>
              </View>
              <Feather name="chevron-down" size={18} color={colors.primary} />
            </Pressable>

            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.contextHint}>
            {isGenericMode
              ? t("aquagpt.genericModeHint")
              : t("aquagpt.pondContextHint", {
                  pond: selectedPondName ?? t("aquagpt.selectPondFallback"),
                })}
          </Text>

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

          <View style={styles.composerArea}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
              {suggestionQuestions.map((question) => (
                <Pressable
                  key={question}
                  onPress={() => handleSend(question)}
                  disabled={isSending}
                  style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <View style={styles.inputShell}>
                <Feather name="zap" size={16} color={colors.primary} />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={isGenericMode ? t("aquagpt.askGeneral") : t("aquagpt.askPond")}
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  editable={!isSending}
                  returnKeyType="send"
                  onSubmitEditing={() => handleSend(draft)}
                />
              </View>

              <Pressable
                onPress={() => handleSend(draft)}
                disabled={isSending || !draft.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (isSending || !draft.trim()) && styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("aquagpt.send")}
              >
                {isSending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Feather name="send" size={18} color={colors.white} />
                )}
              </Pressable>
            </View>

            <Text style={styles.footerNote}>{t("aquagpt.poweredBy")}</Text>
          </View>

          <BottomNav activeTab="aquagpt" />
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pondPickerOpen} transparent animationType="fade" onRequestClose={() => setPondPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPondPickerOpen(false)}>
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
                <Text style={[styles.modalOptionText, isGenericMode && styles.modalOptionTextSelected]}>
                  {t("aquagpt.genericAssistant")}
                </Text>
                <Text style={styles.modalOptionMeta}>{t("aquagpt.genericDescription")}</Text>
              </View>
              {isGenericMode ? <Feather name="check" size={18} color={colors.primary} /> : null}
            </Pressable>

            {ponds.length === 0 ? (
              <Text style={styles.emptyPondsText}>{t("aquagpt.genericEmptyDescription")}</Text>
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
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  >
                    <View style={styles.modalOptionCopy}>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                        {pond.pondName}
                      </Text>
                    </View>
                    {isSelected ? <Feather name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 40 },
  pondSelector: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  pondSelectorCopy: { alignItems: "center", maxWidth: "75%" },
  headerTitle: { color: colors.primary, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  pondSelectorText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  contextHint: { color: colors.muted, fontSize: 11, fontWeight: "600", paddingHorizontal: 16, marginBottom: 4 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  dateBadgeWrap: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  dateBadge: { backgroundColor: colors.suggestion, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  dateBadgeText: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  composerArea: { paddingTop: 8, paddingBottom: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white, gap: 10 },
  suggestionsRow: { gap: 8, paddingHorizontal: 4 },
  suggestionChip: { backgroundColor: colors.suggestion, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  suggestionText: { color: colors.textDark, fontSize: 13, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputShell: { flex: 1, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  textInput: { flex: 1, color: colors.textDark, fontSize: 14, fontWeight: "500", paddingVertical: Platform.OS === "ios" ? 12 : 8 },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.55 },
  footerNote: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textAlign: "center" },
  pressed: { opacity: 0.88 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "center", paddingHorizontal: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 6, maxHeight: "70%" },
  modalTitle: { color: colors.textDark, fontSize: 16, lineHeight: 22, fontWeight: "800", marginBottom: 6 },
  emptyPondsText: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "500", paddingVertical: 12 },
  modalOption: { minHeight: 54, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  modalOptionSelected: { backgroundColor: colors.softBlue },
  modalOptionCopy: { flex: 1 },
  modalOptionText: { color: colors.textDark, fontSize: 15, fontWeight: "700" },
  modalOptionTextSelected: { color: colors.primary },
  modalOptionMeta: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "500" },
});
