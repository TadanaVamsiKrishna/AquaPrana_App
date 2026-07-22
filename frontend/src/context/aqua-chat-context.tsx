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
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { uploadAquaGptFile } from "../lib/aquagpt-files";
import { pickMultipleImages, pickSingleImage, promptImageSource } from "../lib/record-images";
import {
  askAquaGPT,
  transcribeAquaGptAudio,
  type AquaGPTRequestContext,
} from "../services/aquagpt";
import {
  createAquaGptSession,
  deleteAquaGptSession,
  fetchAquaGptMessages,
  isValidAquaGptUuid,
  listAquaGptSessionsForPond,
  renameAquaGptSession,
  saveAquaGptMessage,
  type AquaGptSessionSummary,
} from "../services/aquagpt-messages";
import { getFarmerProfile } from "../services/local-profile";
import { getSupabasePonds } from "../services/pond";
import { supabase } from "../lib/supabase";

export type ChatRole = "assistant" | "user";
export type ChatMessageType = "text" | "image" | "document" | "audio";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  messageType?: ChatMessageType;
  fileUrl?: string | null;
  localUri?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  transcript?: string | null;
  pondName?: string;
  createdAt?: string;
};

export type AquaChatPondOption = {
  id: string;
  pondName: string;
};

export const GENERIC_ASSISTANT_ID = "__generic_assistant__";
export const GENERIC_ASSISTANT_LABEL = "Generic Assistant";

export const isGenericAssistantId = (pondId: string | null | undefined) =>
  !pondId || pondId === GENERIC_ASSISTANT_ID;

const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

const MAX_ATTACHMENT_COUNT = 5;

type AquaChatContextValue = {
  messages: ChatMessage[];
  draft: string;
  isSending: boolean;
  isUploading: boolean;
  isRecording: boolean;
  isLoadingMessages: boolean;
  ponds: AquaChatPondOption[];
  selectedPondId: string | null;
  selectedPondName: string | null;
  isGenericMode: boolean;
  activeSessionId: string | null;
  setDraft: (value: string) => void;
  setSelectedPondId: (pondId: string) => void;
  sendQuestion: (
    question: string,
    requestContext?: AquaGPTRequestContext,
  ) => Promise<void>;
  sendImageAttachment: (requestContext?: AquaGPTRequestContext) => Promise<void>;
  sendDocumentAttachment: (
    requestContext?: AquaGPTRequestContext,
  ) => Promise<void>;
  startAudioRecording: () => Promise<void>;
  stopAudioRecordingAndSend: (
    requestContext?: AquaGPTRequestContext,
  ) => Promise<void>;
  refreshPonds: () => Promise<void>;
  reloadMessages: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  openConversation: (sessionId: string) => Promise<void>;
  listConversations: () => Promise<AquaGptSessionSummary[]>;
  renameConversation: (
    sessionId: string,
    title: string,
  ) => Promise<{ error: Error | null }>;
  deleteConversation: (
    sessionId: string,
  ) => Promise<{ error: Error | null }>;
};

const AquaChatContext = createContext<AquaChatContextValue | null>(null);

function buildWelcomeMessage(farmerName: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    text: `Hi, ${farmerName}! 👋\nI'm AquaGPT, your pond assistant. Ask me anything about your pond or farming.`,
    messageType: "text",
  };
}

function buildAttachmentPrompt(
  messageType: Exclude<ChatMessageType, "text">,
  fileName: string,
  transcript?: string | null,
) {
  if (messageType === "audio") {
    return transcript?.trim()
      ? transcript.trim()
      : "Please review my voice note about my pond.";
  }

  if (messageType === "image") {
    return `I shared an image (${fileName}). Please review it and advise based on my pond context.`;
  }

  return `I shared a document (${fileName}). Please advise based on the file name and my pond context.`;
}

export function AquaChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [ponds, setPonds] = useState<AquaChatPondOption[]>([]);
  const [selectedPondId, setSelectedPondIdState] = useState<string | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState("Farmer");

  const messagesRef = useRef<ChatMessage[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const welcomeReadyRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionCreatePromiseRef = useRef<Promise<string | null> | null>(null);
  const chatScopeRef = useRef<string>("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setActiveSessionId = useCallback((nextSessionId: string | null) => {
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
  }, []);

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

  const isGenericMode = selectedPondId === GENERIC_ASSISTANT_ID;

  const selectedPondName = useMemo(() => {
    if (selectedPondId === GENERIC_ASSISTANT_ID) {
      return GENERIC_ASSISTANT_LABEL;
    }
    const match = ponds.find((pond) => pond.id === selectedPondId);
    return match?.pondName ?? null;
  }, [ponds, selectedPondId]);

  const resolveContext = useCallback(
    (requestContext?: AquaGPTRequestContext) => {
      const requestedPondId = requestContext?.pondId ?? selectedPondId;
      const useGeneric = isGenericAssistantId(requestedPondId);
      const pondId = useGeneric ? null : requestedPondId;

      return {
        useGeneric,
        pondId,
        cycleId: useGeneric ? null : requestContext?.cycleId ?? null,
        screen: requestContext?.screen ?? null,
        mode: useGeneric ? ("generic" as const) : ("pond" as const),
      };
    },
    [selectedPondId],
  );

  const loadSessionMessages = useCallback(
    async (_nextPondId: string | null, nextUserId: string | null) => {
      // Drop any in-flight session create from the previous pond.
      sessionCreatePromiseRef.current = null;

      // Do NOT auto-resume the latest session. Resuming caused every new
      // question to append into one conversation, so History only showed a
      // single card. Start a fresh chat; past threads stay in History and
      // open explicitly via openConversation.
      setIsLoadingMessages(true);
      setActiveSessionId(null);
      setMessages([buildWelcomeMessage(farmerName)]);

      if (!nextUserId) {
        setIsLoadingMessages(false);
        return;
      }

      setIsLoadingMessages(false);
    },
    [farmerName, setActiveSessionId],
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await refreshPonds();

      const [profile, authResult] = await Promise.all([
        getFarmerProfile(),
        supabase.auth.getUser(),
      ]);

      if (!mounted) {
        return;
      }

      const name = profile?.name?.trim() || "Farmer";
      setFarmerName(name);
      const nextUserId = authResult.data.user?.id ?? null;
      setUserId(nextUserId);
      welcomeReadyRef.current = true;
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [refreshPonds]);

  useEffect(() => {
    if (!welcomeReadyRef.current) {
      return;
    }

    // Only reset the chat when pond/user scope changes — not when the
    // loadSessionMessages callback identity changes (e.g. farmerName load),
    // which would wipe a conversation opened from History.
    const scopeKey = `${userId ?? ""}:${selectedPondId ?? ""}`;
    if (chatScopeRef.current === scopeKey) {
      return;
    }
    chatScopeRef.current = scopeKey;

    void loadSessionMessages(selectedPondId, userId);
  }, [selectedPondId, userId, loadSessionMessages]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (isValidAquaGptUuid(sessionIdRef.current)) {
      return sessionIdRef.current;
    }

    // Drop invalid values like "undefined" / "" so we recreate cleanly.
    if (sessionIdRef.current) {
      console.log("[AquaChat] clearing invalid sessionId:", sessionIdRef.current);
      setActiveSessionId(null);
    }

    if (!isValidAquaGptUuid(userId)) {
      throw new Error(
        userId ? "Invalid user_id." : "Authentication failed",
      );
    }

    // Reuse one in-flight create so user + assistant (or rapid sends)
    // never open multiple sessions for the same turn.
    if (sessionCreatePromiseRef.current) {
      return sessionCreatePromiseRef.current;
    }

    const pondId =
      selectedPondId === GENERIC_ASSISTANT_ID ? null : selectedPondId;

    if (pondId != null && !isValidAquaGptUuid(pondId)) {
      throw new Error("Invalid pond_id.");
    }

    sessionCreatePromiseRef.current = (async () => {
      if (isValidAquaGptUuid(sessionIdRef.current)) {
        return sessionIdRef.current;
      }

      const { sessionId: nextSessionId, error } = await createAquaGptSession(
        userId,
        pondId,
      );

      if (error || !isValidAquaGptUuid(nextSessionId)) {
        console.log("[AquaChat] ensure session error:", error);
        throw error ?? new Error("Failed to create AquaGPT session.");
      }

      setActiveSessionId(nextSessionId);
      console.log("[AquaChat] session ready", {
        sessionId: nextSessionId,
        pondId,
        userId,
      });
      return nextSessionId;
    })().finally(() => {
      sessionCreatePromiseRef.current = null;
    });

    return sessionCreatePromiseRef.current;
  }, [selectedPondId, setActiveSessionId, userId]);

  const startNewConversation = useCallback(async () => {
    // Clear UI only — session is created on the first sent message so
    // empty threads do not clutter history.
    sessionCreatePromiseRef.current = null;
    setActiveSessionId(null);
    setDraft("");
    setMessages([buildWelcomeMessage(farmerName)]);

    if (!userId) {
      Alert.alert(
        "Sign in required",
        "Please sign in again to start a new conversation.",
      );
    }
  }, [farmerName, setActiveSessionId, userId]);

  const openConversation = useCallback(
    async (nextSessionId: string) => {
      setIsLoadingMessages(true);
      sessionCreatePromiseRef.current = null;
      setActiveSessionId(nextSessionId);

      try {
        const { messages: storedMessages, error } =
          await fetchAquaGptMessages(nextSessionId);

        if (error) {
          console.log("[AquaChat] open conversation error:", error);
          Alert.alert(
            "Unable to open conversation",
            error.message || "Please try again.",
          );
          setMessages([buildWelcomeMessage(farmerName)]);
          setIsLoadingMessages(false);
          return;
        }

        setDraft("");
        setMessages(
          storedMessages.length > 0
            ? storedMessages
            : [buildWelcomeMessage(farmerName)],
        );
      } catch (error) {
        console.log("[AquaChat] open conversation failed:", error);
        Alert.alert(
          "Unable to open conversation",
          "Please check your connection and try again.",
        );
        setMessages([buildWelcomeMessage(farmerName)]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [farmerName, setActiveSessionId],
  );

  const listConversations = useCallback(async () => {
    if (!userId) {
      return [];
    }

    const pondId =
      selectedPondId === GENERIC_ASSISTANT_ID ? null : selectedPondId;

    try {
      const { sessions, error } = await listAquaGptSessionsForPond(
        userId,
        pondId,
      );

      if (error) {
        console.log("[AquaChat] list conversations error:", error);
        Alert.alert(
          "Unable to load history",
          error.message || "Please try again.",
        );
        return [];
      }

      return sessions;
    } catch (error) {
      console.log("[AquaChat] list conversations failed:", error);
      Alert.alert(
        "Unable to load history",
        "Please check your connection and try again.",
      );
      return [];
    }
  }, [selectedPondId, userId]);

  const renameConversation = useCallback(
    async (targetSessionId: string, title: string) => {
      return renameAquaGptSession(targetSessionId, title);
    },
    [],
  );

  const deleteConversation = useCallback(
    async (targetSessionId: string) => {
      const { error } = await deleteAquaGptSession(targetSessionId);
      if (error) {
        return { error };
      }

      if (sessionIdRef.current === targetSessionId) {
        await startNewConversation();
      }

      return { error: null };
    },
    [startNewConversation],
  );

  const persistMessage = useCallback(
    async (message: ChatMessage, pondId: string | null) => {
      if (message.id === "welcome") {
        return message;
      }

      // Never insert messages until a valid session UUID exists.
      const activeSessionId = await ensureSession();
      if (!isValidAquaGptUuid(activeSessionId)) {
        throw new Error("Missing valid session_id.");
      }
      if (!isValidAquaGptUuid(userId)) {
        throw new Error(
          userId ? "Invalid user_id." : "Authentication failed",
        );
      }

      const safePondId = isValidAquaGptUuid(pondId) ? pondId : null;

      const { message: saved, error } = await saveAquaGptMessage(
        {
          sessionId: activeSessionId,
          userId,
          pondId: safePondId,
          role: message.role,
          messageType: message.messageType ?? "text",
          content:
            message.messageType === "audio"
              ? message.transcript ?? message.text
              : message.text,
          filePath: message.filePath ?? null,
          fileName: message.fileName ?? null,
          mimeType: message.mimeType ?? null,
        },
        message,
      );

      if (error) {
        console.log("[AquaChat] save message error:", error);
        Alert.alert(
          "Unable to save chat",
          error.message || "Your message was sent, but history could not be saved.",
        );
        return message;
      }

      return saved ?? message;
    },
    [ensureSession, userId],
  );

  const requestAssistantReply = useCallback(
    async (
      question: string,
      requestContext?: AquaGPTRequestContext,
    ): Promise<ChatMessage> => {
      const context = resolveContext(requestContext);
      const history = messagesRef.current
        .filter((message) => message.id !== "welcome")
        .slice(-8)
        .map((message) => ({
          role: message.role,
          text:
            message.messageType === "audio"
              ? message.transcript || message.text
              : message.text,
        }));

      const sessionId = await ensureSession();

      console.log({
        sessionId,
        pondId: context.pondId,
        userId,
        requestBody: {
          mode: context.mode,
          question,
          sessionId,
          pondId: context.pondId,
          userId,
        },
      });

      const reply = await askAquaGPT(question, {
        ...requestContext,
        pondId: context.pondId,
        cycleId: context.cycleId,
        mode: context.mode,
        screen: context.screen,
        sessionId,
        conversationHistory: history,
      });

      return {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply,
        messageType: "text",
      };
    },
    [ensureSession, resolveContext, userId],
  );

  const appendAssistantReply = useCallback(
    async (question: string, requestContext?: AquaGPTRequestContext) => {
      const context = resolveContext(requestContext);
      try {
        const assistantMessage = await requestAssistantReply(
          question,
          requestContext,
        );
        setMessages((current) => [...current, assistantMessage]);
        await persistMessage(assistantMessage, context.pondId);
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : JSON.stringify(error);
        console.log("[AquaChat] send error:", error);
        console.log("[AquaChat] send error detail:", detail);

        const fallback: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: detail || "Unable to reach AquaGPT server.",
          messageType: "text",
        };
        setMessages((current) => [...current, fallback]);
        await persistMessage(fallback, context.pondId);
      }
    },
    [persistMessage, requestAssistantReply, resolveContext],
  );

  const setSelectedPondId = useCallback((pondId: string) => {
    setSelectedPondIdState(pondId);
  }, []);

  const beginFreshChatSession = useCallback(() => {
    // Every user question becomes its own History conversation.
    // User + assistant for this turn still share one session_id.
    sessionCreatePromiseRef.current = null;
    setActiveSessionId(null);
  }, [setActiveSessionId]);

  const sendQuestion = useCallback(
    async (question: string, requestContext?: AquaGPTRequestContext) => {
      const trimmed = question.trim();
      if (!trimmed || isSending || isUploading) {
        return;
      }

      const context = resolveContext(requestContext);

      if (
        !context.useGeneric &&
        context.pondId &&
        context.pondId !== selectedPondId
      ) {
        setSelectedPondIdState(context.pondId);
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        messageType: "text",
        pondName: context.useGeneric
          ? GENERIC_ASSISTANT_LABEL
          : selectedPondName ?? undefined,
      };

      setMessages((current) => [...current, userMessage]);
      setDraft("");
      setIsSending(true);

      try {
        // New conversation_id for this chat so History lists every question.
        beginFreshChatSession();
        const sessionId = await ensureSession();
        console.log({
          sessionId,
          pondId: context.pondId,
          userId,
          requestBody: {
            mode: context.mode,
            question: trimmed,
            sessionId,
            pondId: context.pondId,
            userId,
          },
        });

        const savedUserMessage = await persistMessage(
          userMessage,
          context.pondId,
        );
        setMessages((current) =>
          current.map((message) =>
            message.id === userMessage.id ? savedUserMessage : message,
          ),
        );

        await appendAssistantReply(trimmed, requestContext);
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : JSON.stringify(error);
        console.log("[AquaChat] sendQuestion failed:", error);
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: detail || "Unable to reach AquaGPT server.",
            messageType: "text",
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [
      appendAssistantReply,
      beginFreshChatSession,
      ensureSession,
      isSending,
      isUploading,
      persistMessage,
      resolveContext,
      selectedPondId,
      selectedPondName,
      userId,
    ],
  );

  const sendUploadedAttachment = useCallback(
    async (
      messageType: Exclude<ChatMessageType, "text">,
      upload: {
        filePath: string;
        fileUrl: string;
        fileName: string;
        mimeType: string;
        localUri?: string | null;
      },
      requestContext?: AquaGPTRequestContext,
      transcript?: string | null,
      options?: { skipAssistantReply?: boolean },
    ) => {
      const context = resolveContext(requestContext);
      const prompt = buildAttachmentPrompt(
        messageType,
        upload.fileName,
        transcript,
      );

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        text: prompt,
        messageType,
        fileUrl: upload.fileUrl,
        localUri: upload.localUri ?? upload.fileUrl,
        filePath: upload.filePath,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        transcript: transcript ?? null,
        pondName: context.useGeneric
          ? GENERIC_ASSISTANT_LABEL
          : selectedPondName ?? undefined,
      };

      setMessages((current) => [...current, userMessage]);

      // One History card per chat turn. Multi-image batches call
      // beginFreshChatSession once before the loop, then reuse that session.
      if (!options?.skipAssistantReply) {
        beginFreshChatSession();
      }

      const savedUserMessage = await persistMessage(
        userMessage,
        context.pondId,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === userMessage.id ? savedUserMessage : message,
        ),
      );

      if (options?.skipAssistantReply) {
        return prompt;
      }

      setIsSending(true);
      try {
        await appendAssistantReply(prompt, requestContext);
      } finally {
        setIsSending(false);
      }

      return prompt;
    },
    [
      appendAssistantReply,
      beginFreshChatSession,
      persistMessage,
      resolveContext,
      selectedPondName,
    ],
  );

  const sendImageAttachment = useCallback(
    async (requestContext?: AquaGPTRequestContext) => {
      if (isSending || isUploading) {
        return;
      }

      const pickAndUpload = async (source: "camera" | "gallery") => {
        setIsUploading(true);
        try {
          let resolvedImages: Awaited<ReturnType<typeof pickMultipleImages>> =
            null;

          if (source === "camera") {
            const single = await pickSingleImage("camera");
            resolvedImages = single ? [single] : null;
          } else {
            resolvedImages = await pickMultipleImages(MAX_ATTACHMENT_COUNT);
          }

          if (!resolvedImages?.length) {
            return;
          }

          const { data: authData } = await supabase.auth.getUser();
          const prompts: string[] = [];

          // One History conversation for this attachment batch.
          beginFreshChatSession();

          for (const picked of resolvedImages) {
            const upload = await uploadAquaGptFile({
              uri: picked.uri,
              folder: "images",
              fileName: picked.fileName,
              mimeType: picked.mimeType,
              userId: authData.user?.id,
            });

            if (!upload.data) {
              Alert.alert(
                "Upload failed",
                upload.error ?? "Unable to upload image.",
              );
              continue;
            }

            const prompt = await sendUploadedAttachment(
              "image",
              upload.data,
              requestContext,
              null,
              {
                skipAssistantReply: resolvedImages.length > 1,
              },
            );

            if (prompt) {
              prompts.push(prompt);
            }
          }

          if (prompts.length > 1) {
            setIsSending(true);
            try {
              await appendAssistantReply(
                `I shared ${prompts.length} images. Please review them and advise based on my pond context.`,
                requestContext,
              );
            } finally {
              setIsSending(false);
            }
          }
        } finally {
          setIsUploading(false);
        }
      };

      promptImageSource((source) => {
        void pickAndUpload(source);
      });
    },
    [
      appendAssistantReply,
      beginFreshChatSession,
      isSending,
      isUploading,
      sendUploadedAttachment,
    ],
  );

  const sendDocumentAttachment = useCallback(
    async (requestContext?: AquaGPTRequestContext) => {
      if (isSending || isUploading) {
        return;
      }

      setIsUploading(true);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: DOCUMENT_MIME_TYPES,
          copyToCacheDirectory: true,
          multiple: true,
        });

        if (result.canceled || !result.assets?.length) {
          return;
        }

        const assets = result.assets.slice(0, MAX_ATTACHMENT_COUNT);
        const { data: authData } = await supabase.auth.getUser();
        const prompts: string[] = [];

        beginFreshChatSession();

        for (const asset of assets) {
          const upload = await uploadAquaGptFile({
            uri: asset.uri,
            folder: "documents",
            fileName: asset.name,
            mimeType: asset.mimeType ?? "application/octet-stream",
            userId: authData.user?.id,
          });

          if (!upload.data) {
            Alert.alert(
              "Upload failed",
              upload.error ?? "Unable to upload document.",
            );
            continue;
          }

          const prompt = await sendUploadedAttachment(
            "document",
            upload.data,
            requestContext,
            null,
            {
              skipAssistantReply: assets.length > 1,
            },
          );

          if (prompt) {
            prompts.push(prompt);
          }
        }

        if (prompts.length > 1) {
          setIsSending(true);
          try {
            await appendAssistantReply(
              `I shared ${prompts.length} documents. Please advise based on the file names and my pond context.`,
              requestContext,
            );
          } finally {
            setIsSending(false);
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [
      appendAssistantReply,
      beginFreshChatSession,
      isSending,
      isUploading,
      sendUploadedAttachment,
    ],
  );

  const startAudioRecording = useCallback(async () => {
    if (isRecording || isSending || isUploading) {
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Microphone permission is required to record audio.",
      );
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }, [isRecording, isSending, isUploading]);

  const stopAudioRecordingAndSend = useCallback(
    async (requestContext?: AquaGPTRequestContext) => {
      const recording = recordingRef.current;
      if (!recording || !isRecording) {
        return;
      }

      setIsRecording(false);
      setIsUploading(true);

      try {
        await recording.stopAndUnloadAsync();
        recordingRef.current = null;

        const uri = recording.getURI();
        if (!uri) {
          Alert.alert("Recording failed", "No audio was captured.");
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        const upload = await uploadAquaGptFile({
          uri,
          folder: "audio",
          fileName: `voice-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          userId: authData.user?.id,
        });

        if (!upload.data) {
          Alert.alert("Upload failed", upload.error ?? "Unable to upload audio.");
          return;
        }

        let transcript = "";
        try {
          transcript = await transcribeAquaGptAudio(upload.data.filePath);
        } catch (error) {
          console.log("[AquaChat] transcription error:", error);
          Alert.alert(
            "Transcription failed",
            "Audio was saved, but transcription could not be completed.",
          );
        }

        await sendUploadedAttachment(
          "audio",
          upload.data,
          requestContext,
          transcript,
        );
      } finally {
        setIsUploading(false);
      }
    },
    [isRecording, sendUploadedAttachment],
  );

  const reloadMessages = useCallback(async () => {
    await loadSessionMessages(selectedPondId, userId);
  }, [loadSessionMessages, selectedPondId, userId]);

  const value = useMemo<AquaChatContextValue>(
    () => ({
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
      activeSessionId: sessionId,
      setDraft,
      setSelectedPondId,
      sendQuestion,
      sendImageAttachment,
      sendDocumentAttachment,
      startAudioRecording,
      stopAudioRecordingAndSend,
      refreshPonds,
      reloadMessages,
      startNewConversation,
      openConversation,
      listConversations,
      renameConversation,
      deleteConversation,
    }),
    [
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
      sessionId,
      setSelectedPondId,
      sendQuestion,
      sendImageAttachment,
      sendDocumentAttachment,
      startAudioRecording,
      stopAudioRecordingAndSend,
      refreshPonds,
      reloadMessages,
      startNewConversation,
      openConversation,
      listConversations,
      renameConversation,
      deleteConversation,
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

export const MOST_ASKED_QUESTIONS = [
  "Why is Ammonia high?",
  "Should I harvest now?",
  "How is my FCR trend?",
  "What is the survival outlook?",
  "Is water quality stable?",
  "When should I reduce feed?",
];
