import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFarmerProfile } from "../services/local-profile";
import { getPonds, type StoredPond } from "../services/local-ponds";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#004A9F",
  background: "#F7FAFC",
  white: "#FFFFFF",
  text: "#0B3A6E",
  textDark: "#1F2937",
  muted: "#6B7280",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  bubble: "#FFFFFF",
  suggestion: "#EEF2F7",
  shadow: "#0A4F9E",
};

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  pondName?: string;
};

const MOST_ASKED_QUESTIONS = [
  "Why is Ammonia high?",
  "Should I harvest now?",
  "How is my FCR trend?",
  "What is the survival outlook?",
  "Is water quality stable?",
  "When should I reduce feed?",
];

function buildWelcomeMessage(farmerName: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    text: `Hi, ${farmerName}! 👋\nI'm AquaGPT, your pond assistant. Ask me anything about your pond or farming.`,
  };
}

function buildAssistantReply(question: string, pond: StoredPond | null): string {
  const pondName = pond?.pondName ?? "your pond";
  const lower = question.toLowerCase();

  if (lower.includes("ammonia")) {
    return `For ${pondName}, elevated ammonia is often driven by excess feed, weak aeration, or rising biomass load.\n\nTry this next:\n1. Reduce feed by about 20%\n2. Increase aeration overnight\n3. Check sludge and water exchange\n\nI can also compare this to your last log if you ask.`;
  }

  if (lower.includes("harvest")) {
    const window =
      pond?.harvestWindowStart && pond?.harvestWindowEnd
        ? `${pond.harvestWindowStart} – ${pond.harvestWindowEnd}`
        : "your planned harvest window";

    return `${pondName} is on day ${pond?.cycleDay ?? "—"}. Harvest readiness depends on size, survival (${pond?.survivalRate ?? "—"}), and market timing.\n\nSuggested harvest window: ${window}.\nWant a biomass and FCR check before deciding?`;
  }

  if (lower.includes("fcr")) {
    return `FCR for ${pondName} looks sensitive to recent feed changes. Keep daily feed logs tight for the next 5 days so I can plot a clearer trend.\n\nBiomass right now: ${pond?.biomass ?? "—"}.`;
  }

  if (lower.includes("survival")) {
    return `Current survival for ${pondName} is ${pond?.survivalRate ?? "—"}. Watch mortality logs and water quality together — stress events usually show up in both.`;
  }

  if (lower.includes("water") || lower.includes("quality")) {
    return `Water quality for ${pondName} is currently ${pond?.waterQualityStatus ?? "Not logged"}. Prioritize DO, pH, and ammonia in your next pond check.`;
  }

  if (lower.includes("feed") || lower.includes("reduc")) {
    return `If conditions are unstable on ${pondName}, trim feed about 15–20% for 1–2 days while aeration stays high. Then ramp back once ammonia improves.`;
  }

  return `Got it. For ${pondName}, I can help with ammonia risk, harvest timing, FCR, survival, or water quality.\n\nAsk one of the suggested questions below, or type a custom pond question.`;
}

function MessageBubble({ message }: { message: ChatMessage }) {
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
        <Text style={styles.assistantLabel}>AquaGPT Assistant</Text>
      </View>

      <View style={styles.assistantBubble}>
        <Text style={styles.assistantBubbleText}>{message.text}</Text>
      </View>
    </View>
  );
}

export default function AquaGptScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [ponds, setPonds] = useState<StoredPond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string | null>(null);
  const [pondPickerOpen, setPondPickerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const selectedPond = useMemo(
    () => ponds.find((pond) => pond.id === selectedPondId) ?? ponds[0] ?? null,
    [ponds, selectedPondId],
  );

  const loadPonds = useCallback(async () => {
    const saved = await getPonds();
    setPonds(saved);

    setSelectedPondId((current) => {
      if (current && saved.some((pond) => pond.id === current)) {
        return current;
      }

      return saved[0]?.id ?? null;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPonds();
    }, [loadPonds]),
  );

  useEffect(() => {
    let mounted = true;

    const startChat = async () => {
      const profile = await getFarmerProfile();
      if (!mounted) {
        return;
      }

      const name = profile?.name?.trim() || "Farmer";
      setMessages([buildWelcomeMessage(name)]);
    };

    startChat();

    return () => {
      mounted = false;
    };
  }, [selectedPond?.id]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages]);

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      pondName: selectedPond?.pondName,
      text: buildAssistantReply(trimmed, selectedPond),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
  };

  const headerTitle = selectedPond?.pondName ?? "Select Pond";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.replace("/home" as never)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color={colors.primary} />
            </Pressable>

            <Pressable
              onPress={() => setPondPickerOpen(true)}
              style={({ pressed }) => [
                styles.pondSelector,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Select pond"
            >
              <Text style={styles.pondSelectorText} numberOfLines={1}>
                {headerTitle}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.primary} />
            </Pressable>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>G</Text>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.dateBadgeWrap}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>TODAY</Text>
                </View>
              </View>
            }
            renderItem={({ item }) => <MessageBubble message={item} />}
          />

          <View style={styles.composerArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
            >
              {MOST_ASKED_QUESTIONS.map((question) => (
                <Pressable
                  key={question}
                  onPress={() => sendQuestion(question)}
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
              <View style={styles.inputShell}>
                <Feather name="zap" size={16} color={colors.primary} />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type your question..."
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  returnKeyType="send"
                  onSubmitEditing={() => sendQuestion(draft)}
                />
                <Pressable
                  onPress={() =>
                    sendQuestion("Give me a quick health summary for this pond")
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Voice input placeholder"
                >
                  <Feather name="mic" size={18} color={colors.muted} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => sendQuestion(draft)}
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Feather name="send" size={18} color={colors.white} />
              </Pressable>
            </View>

            <Text style={styles.footerNote}>
              POWERED BY AQUAPRANA INTELLIGENCE ENGINE
            </Text>
          </View>
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
            <Text style={styles.modalTitle}>Select Pond</Text>

            {ponds.length === 0 ? (
              <Text style={styles.emptyPondsText}>
                No ponds yet. Add a pond from the dashboard first.
              </Text>
            ) : (
              ponds.map((pond) => {
                const isSelected = pond.id === selectedPond?.id;

                return (
                  <Pressable
                    key={pond.id}
                    onPress={() => {
                      setSelectedPondId(pond.id);
                      setPondPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      isSelected && styles.modalOptionSelected,
                      pressed && styles.pressed,
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
                      <Text style={styles.modalOptionMeta}>
                        {pond.species} · Day {pond.cycleDay}
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
  screen: {
    flex: 1,
  },
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
  pondSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  pondSelectorText: {
    color: colors.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    maxWidth: "85%",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  dateBadgeWrap: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
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
  assistantBlock: {
    gap: 8,
    alignItems: "flex-start",
  },
  assistantLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assistantIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
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
  userBubbleWrap: {
    alignItems: "flex-end",
  },
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
  composerArea: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
  },
  suggestionsRow: {
    gap: 8,
    paddingHorizontal: 4,
  },
  suggestionChip: {
    backgroundColor: colors.suggestion,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionText: {
    color: colors.textDark,
    fontSize: 13,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputShell: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  footerNote: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
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
  modalOptionSelected: {
    backgroundColor: colors.softBlue,
  },
  modalOptionCopy: {
    flex: 1,
  },
  modalOptionText: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "700",
  },
  modalOptionTextSelected: {
    color: colors.primary,
  },
  modalOptionMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
});
