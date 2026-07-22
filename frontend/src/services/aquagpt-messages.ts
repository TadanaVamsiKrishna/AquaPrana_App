import type { ChatMessage, ChatMessageType } from "../context/aqua-chat-context";
import { getAquaGptFileUrl } from "../lib/aquagpt-files";
import { supabase } from "../lib/supabase";

export type AquaGptMessageRow = {
  id: string;
  session_id: string | null;
  user_id?: string | null;
  pond_id?: string | null;
  role: "user" | "assistant";
  message_type?: ChatMessageType | null;
  content: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
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

export type AquaGptSessionSummary = {
  id: string;
  pondId: string | null;
  title: string;
  preview: string;
  createdAt: string;
  lastActivity: string;
};

const MESSAGE_SELECT =
  "id, session_id, user_id, pond_id, role, message_type, content, file_path, file_name, mime_type, created_at";

const MESSAGE_SELECT_MINIMAL = "id, session_id, role, content, created_at";

function getPublicFileUrl(filePath: string | null | undefined) {
  if (!filePath) {
    return null;
  }

  const { data } = supabase.storage
    .from("aquagpt-files")
    .getPublicUrl(filePath);

  return data.publicUrl ?? null;
}

function titleFromMessage(content?: string | null) {
  const cleaned = (content ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "New conversation";
  }
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
}

function previewFromContent(content?: string | null) {
  const cleaned = (content ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

export async function mapRowToChatMessage(
  row: AquaGptMessageRow,
): Promise<ChatMessage> {
  const messageType = normalizeMessageType(row);
  const fileUrl =
    (await getAquaGptFileUrl(row.file_path ?? null)) ??
    getPublicFileUrl(row.file_path);

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAquaGptUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Always create a brand-new conversation session for the pond (or generic). */
export async function createAquaGptSession(
  userId: string,
  pondId: string | null,
  options?: { title?: string | null; language?: string | null },
): Promise<{ sessionId: string | null; error: Error | null }> {
  if (!isValidAquaGptUuid(userId)) {
    return {
      sessionId: null,
      error: new Error(
        userId ? "Invalid user_id." : "Authentication failed",
      ),
    };
  }

  if (
    pondId != null &&
    pondId !== "" &&
    !isValidAquaGptUuid(pondId)
  ) {
    return { sessionId: null, error: new Error("Invalid pond_id.") };
  }

  // Never send "undefined" / "" — omit pond_id for Generic (null column).
  const row: Record<string, unknown> = {
    user_id: userId,
    language: options?.language?.trim() || "English",
    last_activity: new Date().toISOString(),
  };

  if (isValidAquaGptUuid(pondId)) {
    row.pond_id = pondId;
  } else {
    row.pond_id = null;
  }

  if (options?.title?.trim()) {
    row.title = options.title.trim();
  }

  const { data: created, error: createError } = await supabase
    .from("aquagpt_sessions")
    .insert(row)
    .select("id")
    .single();

  if (createError) {
    // Fallback if title/last_activity columns are not yet migrated.
    const fallbackRow: Record<string, unknown> = {
      user_id: userId,
      language: options?.language?.trim() || "English",
      pond_id: isValidAquaGptUuid(pondId) ? pondId : null,
    };

    const fallback = await supabase
      .from("aquagpt_sessions")
      .insert(fallbackRow)
      .select("id")
      .single();

    if (fallback.error) {
      return { sessionId: null, error: new Error(fallback.error.message) };
    }

    if (!isValidAquaGptUuid(fallback.data?.id)) {
      return {
        sessionId: null,
        error: new Error("Session create returned an invalid id."),
      };
    }

    return { sessionId: fallback.data.id, error: null };
  }

  if (!isValidAquaGptUuid(created?.id)) {
    return {
      sessionId: null,
      error: new Error("Session create returned an invalid id."),
    };
  }

  return { sessionId: created.id, error: null };
}

/**
 * Get latest session for pond without creating one.
 * Used when switching ponds to restore the most recent conversation.
 */
export async function getLatestAquaGptSession(
  userId: string,
  pondId: string | null,
): Promise<{ sessionId: string | null; error: Error | null }> {
  let query = supabase
    .from("aquagpt_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("last_activity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  query = pondId ? query.eq("pond_id", pondId) : query.is("pond_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    // Fallback ordering if last_activity is missing.
    let fallbackQuery = supabase
      .from("aquagpt_sessions")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    fallbackQuery = pondId
      ? fallbackQuery.eq("pond_id", pondId)
      : fallbackQuery.is("pond_id", null);

    const fallback = await fallbackQuery.maybeSingle();
    if (fallback.error) {
      return { sessionId: null, error: new Error(fallback.error.message) };
    }
    return { sessionId: fallback.data?.id ?? null, error: null };
  }

  return { sessionId: data?.id ?? null, error: null };
}

/** @deprecated Prefer createAquaGptSession / getLatestAquaGptSession. */
export async function getOrCreateAquaGptSession(
  userId: string,
  pondId: string | null,
): Promise<{ sessionId: string | null; error: Error | null }> {
  const latest = await getLatestAquaGptSession(userId, pondId);
  if (latest.error) {
    return latest;
  }
  if (latest.sessionId) {
    return latest;
  }
  return createAquaGptSession(userId, pondId);
}

export async function fetchAquaGptMessages(
  sessionId: string,
): Promise<{ messages: ChatMessage[]; error: Error | null }> {
  const full = await supabase
    .from("aquagpt_messages")
    .select(MESSAGE_SELECT)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (full.error) {
    const minimal = await supabase
      .from("aquagpt_messages")
      .select(MESSAGE_SELECT_MINIMAL)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (minimal.error) {
      return { messages: [], error: new Error(minimal.error.message) };
    }

    return {
      messages: await Promise.all(
        (minimal.data as AquaGptMessageRow[]).map((row) =>
          mapRowToChatMessage(row),
        ),
      ),
      error: null,
    };
  }

  return {
    messages: await Promise.all(
      (full.data as AquaGptMessageRow[]).map((row) => mapRowToChatMessage(row)),
    ),
    error: null,
  };
}

export async function saveAquaGptMessage(
  input: SaveAquaGptMessageInput,
  originalMessage?: ChatMessage,
): Promise<{ message: ChatMessage | null; error: Error | null }> {
  const content = input.content ?? "";

  const fullInsert = await supabase
    .from("aquagpt_messages")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      pond_id: input.pondId ?? null,
      role: input.role,
      message_type: input.messageType,
      content,
      file_path: input.filePath ?? null,
      file_name: input.fileName ?? null,
      mime_type: input.mimeType ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();

  let row = fullInsert.data as AquaGptMessageRow | null;
  let insertError = fullInsert.error;

  if (insertError) {
    const minimalInsert = await supabase
      .from("aquagpt_messages")
      .insert({
        session_id: input.sessionId,
        role: input.role,
        content,
      })
      .select(MESSAGE_SELECT_MINIMAL)
      .single();

    if (minimalInsert.error) {
      return { message: null, error: new Error(minimalInsert.error.message) };
    }

    row = minimalInsert.data as AquaGptMessageRow;
    insertError = null;
  }

  // Touch session activity, last_message, and set title from first user message.
  const activityAt = new Date().toISOString();
  const previewText = previewFromContent(content);

  if (input.role === "user") {
    const { data: session } = await supabase
      .from("aquagpt_sessions")
      .select("title")
      .eq("id", input.sessionId)
      .maybeSingle();

    const updates: {
      last_activity: string;
      last_message?: string;
      title?: string;
    } = {
      last_activity: activityAt,
      last_message: previewText || content.slice(0, 80),
    };

    if (!session?.title?.trim()) {
      updates.title = titleFromMessage(content);
    }

    const { error: updateError } = await supabase
      .from("aquagpt_sessions")
      .update(updates)
      .eq("id", input.sessionId);

    // Fallback if last_message column is not migrated yet.
    if (updateError) {
      const { last_message: _ignored, ...withoutLastMessage } = updates;
      await supabase
        .from("aquagpt_sessions")
        .update(withoutLastMessage)
        .eq("id", input.sessionId);
    }
  } else {
    const updates = {
      last_activity: activityAt,
      last_message: previewText || content.slice(0, 80),
    };

    const { error: updateError } = await supabase
      .from("aquagpt_sessions")
      .update(updates)
      .eq("id", input.sessionId);

    if (updateError) {
      await supabase
        .from("aquagpt_sessions")
        .update({ last_activity: activityAt })
        .eq("id", input.sessionId);
    }
  }

  if (!row) {
    return { message: null, error: new Error("Unable to save message.") };
  }

  return {
    message: originalMessage
      ? await mergePersistedMessage(originalMessage, row)
      : await mapRowToChatMessage(row),
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

const HISTORY_PAGE_SIZE = 100;

type SessionListRow = {
  id: string;
  pond_id: string | null;
  title?: string | null;
  created_at: string;
  last_activity?: string | null;
  last_message?: string | null;
};

type MessageTurn = {
  userId: string;
  userContent: string;
  userAt: string;
  assistantIds: string[];
  assistantContent: string | null;
  assistantAt: string | null;
};

/**
 * Older builds packed many Q&As into one session. Split those so History
 * shows one card per user question (user + following assistant reply).
 */
export async function splitPackedAquaGptSessions(
  userId: string,
  pondId: string | null,
): Promise<void> {
  if (!isValidAquaGptUuid(userId)) {
    return;
  }

  let sessionQuery = supabase
    .from("aquagpt_sessions")
    .select("id, language")
    .eq("user_id", userId);

  sessionQuery = pondId
    ? sessionQuery.eq("pond_id", pondId)
    : sessionQuery.is("pond_id", null);

  const { data: sessions, error } = await sessionQuery;
  if (error || !sessions?.length) {
    return;
  }

  for (const session of sessions) {
    const { data: messages, error: messagesError } = await supabase
      .from("aquagpt_messages")
      .select("id, role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (messagesError || !messages?.length) {
      continue;
    }

    const turns: MessageTurn[] = [];
    let current: MessageTurn | null = null;

    for (const message of messages) {
      if (message.role === "user") {
        if (current) {
          turns.push(current);
        }
        current = {
          userId: message.id,
          userContent: message.content ?? "",
          userAt: message.created_at,
          assistantIds: [],
          assistantContent: null,
          assistantAt: null,
        };
        continue;
      }

      if (message.role === "assistant" && current) {
        current.assistantIds.push(message.id);
        // Keep the latest assistant text in this turn as preview.
        current.assistantContent = message.content ?? current.assistantContent;
        current.assistantAt = message.created_at;
      }
    }

    if (current) {
      turns.push(current);
    }

    if (turns.length <= 1) {
      continue;
    }

    // Keep the first turn on the original session.
    const first = turns[0];
    const firstUpdates: Record<string, string> = {
      title: titleFromMessage(first.userContent),
      last_activity: first.assistantAt || first.userAt,
      last_message: previewFromContent(
        first.assistantContent || first.userContent,
      ),
    };

    const { error: firstUpdateError } = await supabase
      .from("aquagpt_sessions")
      .update(firstUpdates)
      .eq("id", session.id);

    if (firstUpdateError) {
      await supabase
        .from("aquagpt_sessions")
        .update({
          title: firstUpdates.title,
          last_activity: firstUpdates.last_activity,
        })
        .eq("id", session.id);
    }

    for (const turn of turns.slice(1)) {
      const created = await createAquaGptSession(userId, pondId, {
        title: titleFromMessage(turn.userContent),
        language: session.language ?? "English",
      });

      if (!created.sessionId) {
        console.log("[AquaGPT] split session create failed:", created.error);
        continue;
      }

      const moveIds = [turn.userId, ...turn.assistantIds];
      const { error: moveError } = await supabase
        .from("aquagpt_messages")
        .update({ session_id: created.sessionId })
        .in("id", moveIds);

      if (moveError) {
        console.log("[AquaGPT] split move messages failed:", moveError.message);
        continue;
      }

      const activity = turn.assistantAt || turn.userAt;
      const preview = previewFromContent(
        turn.assistantContent || turn.userContent,
      );
      const { error: metaError } = await supabase
        .from("aquagpt_sessions")
        .update({
          title: titleFromMessage(turn.userContent),
          last_activity: activity,
          last_message: preview,
        })
        .eq("id", created.sessionId);

      if (metaError) {
        await supabase
          .from("aquagpt_sessions")
          .update({
            title: titleFromMessage(turn.userContent),
            last_activity: activity,
          })
          .eq("id", created.sessionId);
      }
    }
  }
}

/** Fetch every conversation for a pond (paginated under the hood, no UI cap). */
export async function listAquaGptSessionsForPond(
  userId: string,
  pondId: string | null,
): Promise<{ sessions: AquaGptSessionSummary[]; error: Error | null }> {
  // Repair packed sessions so every past question appears in History.
  try {
    await splitPackedAquaGptSessions(userId, pondId);
  } catch (error) {
    console.log("[AquaGPT] split packed sessions skipped:", error);
  }

  const rows: SessionListRow[] = [];
  let offset = 0;
  let useMinimal = false;

  while (true) {
    const from = offset;
    const to = offset + HISTORY_PAGE_SIZE - 1;

    let page;
    if (!useMinimal) {
      let query = supabase
        .from("aquagpt_sessions")
        .select("id, pond_id, title, created_at, last_activity, last_message")
        .eq("user_id", userId)
        .order("last_activity", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      query = pondId ? query.eq("pond_id", pondId) : query.is("pond_id", null);
      page = await query;

      if (page.error) {
        useMinimal = true;
        continue;
      }
    } else {
      let query = supabase
        .from("aquagpt_sessions")
        .select("id, pond_id, title, created_at, last_activity")
        .eq("user_id", userId)
        .order("last_activity", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      query = pondId ? query.eq("pond_id", pondId) : query.is("pond_id", null);
      page = await query;

      if (page.error) {
        // Final fallback: created_at only (pre-migration schemas).
        let fallbackQuery = supabase
          .from("aquagpt_sessions")
          .select("id, pond_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, to);

        fallbackQuery = pondId
          ? fallbackQuery.eq("pond_id", pondId)
          : fallbackQuery.is("pond_id", null);

        const fallback = await fallbackQuery;
        if (fallback.error) {
          return { sessions: [], error: new Error(fallback.error.message) };
        }
        page = fallback;
      }
    }

    const batch = (page.data ?? []) as SessionListRow[];
    rows.push(...batch);

    if (batch.length < HISTORY_PAGE_SIZE) {
      break;
    }

    offset += HISTORY_PAGE_SIZE;
  }

  const sessions = (
    await Promise.all(
      rows.map(async (row) => {
        const storedPreview = previewFromContent(row.last_message);
        let title = row.title?.trim() || "";
        let preview = storedPreview;
        let lastActivity = row.last_activity || row.created_at;

        // Only hit messages table when session summary fields are incomplete.
        if (!title || !preview) {
          const messagePreview = await fetchLatestMessagePreview(row.id);
          if (!messagePreview.hasMessages) {
            return null;
          }
          title = title || messagePreview.title || "New conversation";
          preview = preview || messagePreview.preview;
          lastActivity = messagePreview.lastActivity || lastActivity;
        }

        return {
          id: row.id,
          pondId: row.pond_id,
          title: title || "New conversation",
          preview,
          createdAt: row.created_at,
          lastActivity,
        } satisfies AquaGptSessionSummary;
      }),
    )
  ).filter((session): session is AquaGptSessionSummary => session != null);

  // Newest activity first (stable if DB ordering already applied).
  sessions.sort((a, b) => {
    const aTime = new Date(a.lastActivity || a.createdAt).getTime();
    const bTime = new Date(b.lastActivity || b.createdAt).getTime();
    return bTime - aTime;
  });

  return { sessions, error: null };
}

async function fetchLatestMessagePreview(sessionId: string) {
  const { data } = await supabase
    .from("aquagpt_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const firstUser = await supabase
    .from("aquagpt_messages")
    .select("content")
    .eq("session_id", sessionId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    hasMessages: Boolean(data),
    title: titleFromMessage(firstUser.data?.content),
    preview: previewFromContent(data?.content),
    lastActivity: data?.created_at ?? null,
  };
}

export async function renameAquaGptSession(
  sessionId: string,
  title: string,
): Promise<{ error: Error | null }> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { error: new Error("Title cannot be empty.") };
  }

  const { error } = await supabase
    .from("aquagpt_sessions")
    .update({ title: trimmed })
    .eq("id", sessionId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function deleteAquaGptSession(
  sessionId: string,
): Promise<{ error: Error | null }> {
  const { error: messagesError } = await supabase
    .from("aquagpt_messages")
    .delete()
    .eq("session_id", sessionId);

  if (messagesError) {
    console.log("[AquaGPT] delete messages:", messagesError.message);
  }

  const { error } = await supabase
    .from("aquagpt_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
