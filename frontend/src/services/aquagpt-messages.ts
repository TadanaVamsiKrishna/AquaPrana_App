import type { ChatMessage, ChatMessageType } from "../context/aqua-chat-context";
import { getAquaGptFileUrl } from "../lib/aquagpt-files";
import { supabase } from "../lib/supabase";

export type AquaGptMessageRow = {
  id: string;
  session_id: string | null;
  user_id: string;
  pond_id: string | null;
  role: "user" | "assistant";
  message_type: ChatMessageType;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
};

export type SaveAquaGptMessageInput = {
  sessionId: string;
  userId: string;
  pondId?: string | null;
  role: "user" | "assistant";
  messageType: ChatMessageType;
  content?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

function getPublicFileUrl(filePath: string | null) {
  if (!filePath) {
    return null;
  }

  const { data } = supabase.storage
    .from("aquagpt-files")
    .getPublicUrl(filePath);

  return data.publicUrl ?? null;
}

export async function mapRowToChatMessage(
  row: AquaGptMessageRow,
): Promise<ChatMessage> {
  const messageType = normalizeMessageType(row);
  const fileUrl =
    (await getAquaGptFileUrl(row.file_path)) ?? getPublicFileUrl(row.file_path);

  return {
    id: row.id,
    role: row.role,
    text: row.content ?? "",
    messageType,
    fileUrl,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    transcript: messageType === "audio" ? row.content : null,
    createdAt: row.created_at,
  };
}

function normalizeMessageType(row: AquaGptMessageRow): ChatMessageType {
  const rawType = (row.message_type ?? "text").toLowerCase();

  if (rawType === "image" || rawType === "document" || rawType === "audio") {
    return rawType;
  }

  if (row.file_path?.startsWith("images/")) {
    return "image";
  }

  if (row.file_path?.startsWith("documents/")) {
    return "document";
  }

  if (row.file_path?.startsWith("audio/")) {
    return "audio";
  }

  if (row.mime_type?.startsWith("image/")) {
    return "image";
  }

  return "text";
}

export async function getOrCreateAquaGptSession(
  userId: string,
  pondId: string | null,
): Promise<{ sessionId: string | null; error: Error | null }> {
  let query = supabase
    .from("aquagpt_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  query = pondId ? query.eq("pond_id", pondId) : query.is("pond_id", null);

  const { data: existing, error: existingError } = await query.maybeSingle();

  if (existingError) {
    return { sessionId: null, error: new Error(existingError.message) };
  }

  if (existing?.id) {
    return { sessionId: existing.id, error: null };
  }

  const { data: created, error: createError } = await supabase
    .from("aquagpt_sessions")
    .insert({
      user_id: userId,
      pond_id: pondId,
    })
    .select("id")
    .single();

  if (createError) {
    return { sessionId: null, error: new Error(createError.message) };
  }

  return { sessionId: created.id, error: null };
}

export async function fetchAquaGptMessages(
  sessionId: string,
): Promise<{ messages: ChatMessage[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("aquagpt_messages")
    .select(
      "id, session_id, user_id, pond_id, role, message_type, content, file_path, file_name, mime_type, created_at",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return { messages: [], error: new Error(error.message) };
  }

  return {
    messages: await Promise.all(
      (data as AquaGptMessageRow[]).map((row) => mapRowToChatMessage(row)),
    ),
    error: null,
  };
}

export async function saveAquaGptMessage(
  input: SaveAquaGptMessageInput,
  originalMessage?: ChatMessage,
): Promise<{ message: ChatMessage | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("aquagpt_messages")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      pond_id: input.pondId ?? null,
      role: input.role,
      message_type: input.messageType,
      content: input.content ?? null,
      file_path: input.filePath ?? null,
      file_name: input.fileName ?? null,
      mime_type: input.mimeType ?? null,
    })
    .select(
      "id, session_id, user_id, pond_id, role, message_type, content, file_path, file_name, mime_type, created_at",
    )
    .single();

  if (error) {
    return { message: null, error: new Error(error.message) };
  }

  return {
    message: originalMessage
      ? await mergePersistedMessage(originalMessage, data as AquaGptMessageRow)
      : await mapRowToChatMessage(data as AquaGptMessageRow),
    error: null,
  };
}

async function mergePersistedMessage(
  original: ChatMessage,
  row: AquaGptMessageRow,
): Promise<ChatMessage> {
  const saved = await mapRowToChatMessage(row);

  return {
    ...saved,
    localUri: original.localUri ?? saved.localUri,
    messageType: saved.messageType ?? original.messageType,
    fileUrl: saved.fileUrl ?? original.fileUrl,
    filePath: saved.filePath ?? original.filePath,
    fileName: saved.fileName ?? original.fileName,
    mimeType: saved.mimeType ?? original.mimeType,
    transcript: saved.transcript ?? original.transcript,
  };
}
