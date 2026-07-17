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
  fetchAquaGptMessages,
  getOrCreateAquaGptSession,
  saveAquaGptMessage,
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
    async (nextPondId: string | null, nextUserId: string | null) => {
      if (!nextUserId) {
        setMessages([buildWelcomeMessage(farmerName)]);
        setSessionId(null);
        return;
      }

      setIsLoadingMessages(true);

      const pondId =
        nextPondId === GENERIC_ASSISTANT_ID ? null : nextPondId;

      const { sessionId: nextSessionId, error: sessionError } =
        await getOrCreateAquaGptSession(nextUserId, pondId);

      if (sessionError || !nextSessionId) {
        console.log("[AquaChat] session error:", sessionError);
        setMessages([buildWelcomeMessage(farmerName)]);
        setSessionId(null);
        setIsLoadingMessages(false);
        return;
      }

      setSessionId(nextSessionId);

      const { messages: storedMessages, error: messagesError } =
        await fetchAquaGptMessages(nextSessionId);

      if (messagesError) {
        console.log("[AquaChat] messages error:", messagesError);
        setMessages([buildWelcomeMessage(farmerName)]);
        setIsLoadingMessages(false);
        return;
      }

      if (storedMessages.length === 0) {
        setMessages([buildWelcomeMessage(farmerName)]);
      } else {
        setMessages(storedMessages);
      }

      setIsLoadingMessages(false);
    },
    [farmerName],
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

    void loadSessionMessages(selectedPondId, userId);
  }, [selectedPondId, userId, loadSessionMessages]);

  const ensureSession = useCallback(async () => {
    if (sessionId || !userId) {
      return sessionId;
    }

    const pondId =
      selectedPondId === GENERIC_ASSISTANT_ID ? null : selectedPondId;
    const { sessionId: nextSessionId, error } = await getOrCreateAquaGptSession(
      userId,
      pondId,
    );

    if (error || !nextSessionId) {
      console.log("[AquaChat] ensure session error:", error);
      return null;
    }

    setSessionId(nextSessionId);
    return nextSessionId;
  }, [selectedPondId, sessionId, userId]);

  const persistMessage = useCallback(
    async (message: ChatMessage, pondId: string | null) => {
      const activeSessionId = sessionId ?? (await ensureSession());
      if (!activeSessionId || !userId || message.id === "welcome") {
        return message;
      }

      const { message: saved, error } = await saveAquaGptMessage(
        {
          sessionId: activeSessionId,
          userId,
          pondId,
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
        return message;
      }

      return saved ?? message;
    },
    [ensureSession, sessionId, userId],
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

      const reply = await askAquaGPT(question, {
        ...requestContext,
        pondId: context.pondId,
        cycleId: context.cycleId,
        mode: context.mode,
        screen: context.screen,
        conversationHistory: history,
      });

      return {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply,
        messageType: "text",
      };
    },
    [resolveContext],
  );

  const appendAssistantReply = useCallback(
    async (question: string, requestContext?: AquaGPTRequestContext) => {
      try {
        const assistantMessage = await requestAssistantReply(
          question,
          requestContext,
        );
        setMessages((current) => [...current, assistantMessage]);
        const context = resolveContext(requestContext);
        await persistMessage(assistantMessage, context.pondId);
      } catch (error) {
        console.log("[AquaChat] send error:", error);
        const fallback: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Sorry, I couldn't get a response from AquaGPT.",
          messageType: "text",
        };
        setMessages((current) => [...current, fallback]);
      }
    },
    [persistMessage, requestAssistantReply, resolveContext],
  );

  const setSelectedPondId = useCallback((pondId: string) => {
    setSelectedPondIdState(pondId);
  }, []);

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

      const savedUserMessage = await persistMessage(
        userMessage,
        context.pondId,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === userMessage.id ? savedUserMessage : message,
        ),
      );

      try {
        await appendAssistantReply(trimmed, requestContext);
      } finally {
        setIsSending(false);
      }
    },
    [
      appendAssistantReply,
      isSending,
      isUploading,
      persistMessage,
      resolveContext,
      selectedPondId,
      selectedPondName,
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
    [appendAssistantReply, persistMessage, resolveContext, selectedPondName],
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
      setDraft,
      setSelectedPondId,
      sendQuestion,
      sendImageAttachment,
      sendDocumentAttachment,
      startAudioRecording,
      stopAudioRecordingAndSend,
      refreshPonds,
      reloadMessages,
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
      setSelectedPondId,
      sendQuestion,
      sendImageAttachment,
      sendDocumentAttachment,
      startAudioRecording,
      stopAudioRecordingAndSend,
      refreshPonds,
      reloadMessages,
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
