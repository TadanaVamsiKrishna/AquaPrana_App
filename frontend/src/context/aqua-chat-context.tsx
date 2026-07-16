import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { askAquaGPT, type AquaGPTRequestContext } from "../services/aquagpt";
import { getFarmerProfile } from "../services/local-profile";
import { getSupabasePonds } from "../services/pond";

export type ChatRole = "assistant" | "user";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  pondName?: string;
};

export type AquaChatPondOption = {
  id: string;
  pondName: string;
};

/** Special selection: answer without pond/cycle context. */
export const GENERIC_ASSISTANT_ID = "__generic_assistant__";
export const GENERIC_ASSISTANT_LABEL = "Generic Assistant";

export const isGenericAssistantId = (pondId: string | null | undefined) =>
  !pondId || pondId === GENERIC_ASSISTANT_ID;

type AquaChatContextValue = {
  messages: ChatMessage[];
  draft: string;
  isSending: boolean;
  ponds: AquaChatPondOption[];
  selectedPondId: string | null;
  selectedPondName: string | null;
  isGenericMode: boolean;
  setDraft: (value: string) => void;
  setSelectedPondId: (pondId: string) => void;
  sendQuestion: (
    question: string,
    requestContext?: AquaGPTRequestContext,
  ) => Promise<void>;
  refreshPonds: () => Promise<void>;
};

const AquaChatContext = createContext<AquaChatContextValue | null>(null);

export const MOST_ASKED_QUESTIONS = [
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

export function AquaChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ponds, setPonds] = useState<AquaChatPondOption[]>([]);
  const [selectedPondId, setSelectedPondIdState] = useState<string | null>(
    null,
  );
  const welcomeReadyRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshPonds = useCallback(async () => {
    const { data, error } = await getSupabasePonds();

    if (error) {
      console.error("[AquaChat] Unable to load ponds:", error);
      return;
    }

    const nextPonds = (data ?? []).map((pond) => ({
      id: pond.id,
      pondName: pond.name?.trim() || "Pond",
    }));

    setPonds(nextPonds);
    setSelectedPondIdState((current) => {
      if (current === GENERIC_ASSISTANT_ID) {
        return current;
      }
      if (current && nextPonds.some((pond) => pond.id === current)) {
        return current;
      }
      return nextPonds[0]?.id ?? GENERIC_ASSISTANT_ID;
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await refreshPonds();
      if (!mounted || welcomeReadyRef.current) {
        return;
      }

      const profile = await getFarmerProfile();
      if (!mounted) {
        return;
      }

      const name = profile?.name?.trim() || "Farmer";
      setMessages([buildWelcomeMessage(name)]);
      welcomeReadyRef.current = true;
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [refreshPonds]);

  const isGenericMode = selectedPondId === GENERIC_ASSISTANT_ID;

  const selectedPondName = useMemo(() => {
    if (selectedPondId === GENERIC_ASSISTANT_ID) {
      return GENERIC_ASSISTANT_LABEL;
    }
    const match = ponds.find((pond) => pond.id === selectedPondId);
    return match?.pondName ?? null;
  }, [ponds, selectedPondId]);

  const setSelectedPondId = useCallback((pondId: string) => {
    setSelectedPondIdState(pondId);
  }, []);

  const sendQuestion = useCallback(
    async (question: string, requestContext?: AquaGPTRequestContext) => {
      const trimmed = question.trim();
      if (!trimmed || isSending) {
        return;
      }

      const requestedPondId = requestContext?.pondId ?? selectedPondId;
      const useGeneric = isGenericAssistantId(requestedPondId);
      const pondId = useGeneric ? null : requestedPondId;

      if (!useGeneric && pondId && pondId !== selectedPondId) {
        setSelectedPondIdState(pondId);
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        pondName: useGeneric
          ? GENERIC_ASSISTANT_LABEL
          : selectedPondName ?? undefined,
      };

      setMessages((current) => [...current, userMessage]);
      setDraft("");
      setIsSending(true);

      try {
        const history = [...messagesRef.current, userMessage]
          .filter((message) => message.id !== "welcome")
          .slice(-8)
          .map((message) => ({
            role: message.role,
            text: message.text,
          }));

        const reply = await askAquaGPT(trimmed, {
          ...requestContext,
          pondId: pondId ?? null,
          cycleId: useGeneric ? null : requestContext?.cycleId,
          mode: useGeneric ? "generic" : "pond",
          conversationHistory: history,
        });

        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: reply,
          },
        ]);
      } catch (error) {
        console.log("[AquaChat] send error:", error);
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: "Sorry, I couldn't get a response from AquaGPT.",
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, selectedPondId, selectedPondName],
  );

  const value = useMemo<AquaChatContextValue>(
    () => ({
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
    }),
    [
      messages,
      draft,
      isSending,
      ponds,
      selectedPondId,
      selectedPondName,
      isGenericMode,
      setSelectedPondId,
      sendQuestion,
      refreshPonds,
    ],
  );

  return (
    <AquaChatContext.Provider value={value}>{children}</AquaChatContext.Provider>
  );
}

export function useAquaChat() {
  const value = useContext(AquaChatContext);
  if (!value) {
    throw new Error("useAquaChat must be used within AquaChatProvider");
  }
  return value;
}
