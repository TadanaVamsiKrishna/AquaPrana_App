import { supabase } from "./supabase";

export const AQUAGPT_FILES_BUCKET = "aquagpt-files";

export type AquaGptFileFolder = "audio" | "images" | "documents";

export type UploadedAquaGptFile = {
  filePath: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
  localUri?: string | null;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function guessExtension(uri: string, mimeType?: string | null) {
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("gif")) return "gif";
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("mpeg") || mimeType?.includes("mp3")) return "mp3";
  if (mimeType?.includes("wav")) return "wav";
  if (mimeType?.includes("m4a") || mimeType?.includes("mp4")) return "m4a";
  if (mimeType?.includes("csv")) return "csv";
  if (mimeType?.includes("plain")) return "txt";
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) {
    return "xlsx";
  }
  if (mimeType?.includes("word")) return "docx";

  const fromUri = uri.split(".").pop()?.split("?")[0];
  if (fromUri && fromUri.length <= 5) {
    return fromUri;
  }

  return "bin";
}

export async function uploadAquaGptFile({
  uri,
  folder,
  fileName,
  mimeType,
  userId,
}: {
  uri: string;
  folder: AquaGptFileFolder;
  fileName?: string | null;
  mimeType?: string | null;
  userId?: string | null;
}): Promise<{ data: UploadedAquaGptFile | null; error: string | null }> {
  const extension = guessExtension(uri, mimeType);
  const safeName = sanitizeFileName(
    fileName?.trim() || `file-${Date.now()}.${extension}`,
  );
  const ownerPrefix = userId ? `${userId}/` : "";
  const filePath = `${folder}/${ownerPrefix}${Date.now()}-${safeName}`;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const resolvedMime = mimeType ?? blob.type ?? "application/octet-stream";

    const { error } = await supabase.storage
      .from(AQUAGPT_FILES_BUCKET)
      .upload(filePath, blob, {
        contentType: resolvedMime,
        upsert: false,
      });

    if (error) {
      return { data: null, error: error.message };
    }

    const fileUrl = await getAquaGptFileUrl(filePath);

    return {
      data: {
        filePath,
        fileUrl: fileUrl ?? uri,
        fileName: safeName,
        mimeType: resolvedMime,
        fileSize: blob.size ?? null,
        localUri: uri,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to upload file right now.",
    };
  }
}

export async function getAquaGptFileUrl(filePath: string | null) {
  if (!filePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(AQUAGPT_FILES_BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const { data: publicData } = supabase.storage
    .from(AQUAGPT_FILES_BUCKET)
    .getPublicUrl(filePath);

  return publicData.publicUrl ?? null;
}
