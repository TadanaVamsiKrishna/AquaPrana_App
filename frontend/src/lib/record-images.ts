import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import { supabase } from "./supabase";

const CAMERA_PERMISSION_ALERT =
  "Camera permission is required to capture photos.";
const LIBRARY_PERMISSION_ALERT =
  "Photo library permission is required to select images.";

export type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type UploadedImageResult = {
  localUri: string;
  fileName: string;
  remoteUrl: string | null;
  error: string | null;
};

export const requestCameraPermission = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== "granted") {
    Alert.alert("Permission needed", CAMERA_PERMISSION_ALERT);
    return false;
  }

  return true;
};

export const requestMediaLibraryPermission = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    Alert.alert("Permission needed", LIBRARY_PERMISSION_ALERT);
    return false;
  }

  return true;
};

export const pickImageFromCamera = async (): Promise<string[] | null> => {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets.map((asset) => asset.uri);
};

export const pickImagesFromGallery = async (
  selectionLimit = 0,
): Promise<string[] | null> => {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: selectionLimit !== 1,
    selectionLimit: selectionLimit > 0 ? selectionLimit : 0,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets.map((asset) => asset.uri);
};

export const pickRecordImages = async (
  remainingSlots = 5,
): Promise<string[] | null> => {
  if (remainingSlots <= 0) {
    return null;
  }

  if (Platform.OS === "web") {
    return pickImagesFromGallery(remainingSlots);
  }

  return new Promise((resolve) => {
    Alert.alert("Add photo", "Choose how you want to add the image.", [
      {
        text: "Camera",
        onPress: () => {
          void pickImageFromCamera()
            .then(resolve)
            .catch(() => resolve(null));
        },
      },
      {
        text: "Gallery",
        onPress: () => {
          void pickImagesFromGallery(remainingSlots)
            .then(resolve)
            .catch(() => resolve(null));
        },
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
};

export const pickMultipleImages = async (
  selectionLimit = 5,
): Promise<PickedImage[] | null> => {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: selectionLimit > 0 ? selectionLimit : 0,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    fileName: asset.fileName ?? `image-${Date.now()}-${index}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
  }));
};

export const pickSingleImage = async (
  source: "camera" | "gallery",
): Promise<PickedImage | null> => {
  if (source === "camera") {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
    };
  }

  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
  };
};

export const promptImageSource = (
  onPick: (source: "camera" | "gallery") => void,
) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm("Open file picker for photo?")) {
      onPick("gallery");
    }
    return;
  }

  Alert.alert("Add photo", "Choose how you want to add the image.", [
    { text: "Camera", onPress: () => onPick("camera") },
    { text: "Gallery", onPress: () => onPick("gallery") },
    { text: "Cancel", style: "cancel" },
  ]);
};

export const pickRecordImage = async (): Promise<PickedImage | null> => {
  if (Platform.OS === "web") {
    return pickSingleImage("gallery");
  }

  return new Promise((resolve) => {
    Alert.alert("Add photo", "Choose how you want to add the image.", [
      {
        text: "Camera",
        onPress: () => {
          void pickSingleImage("camera")
            .then(resolve)
            .catch(() => resolve(null));
        },
      },
      {
        text: "Gallery",
        onPress: () => {
          void pickSingleImage("gallery")
            .then(resolve)
            .catch(() => resolve(null));
        },
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
};

const guessExtension = (uri: string, mimeType?: string | null) => {
  if (mimeType?.includes("png")) {
    return "png";
  }

  if (mimeType?.includes("webp")) {
    return "webp";
  }

  const fromUri = uri.split(".").pop()?.split("?")[0];
  if (fromUri && fromUri.length <= 4) {
    return fromUri;
  }

  return "jpg";
};

export const uploadImageToSupabaseStorage = async ({
  uri,
  fileName,
  mimeType,
  folder = "records",
  bucket = "pond-records",
}: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  folder?: string;
  bucket?: string;
}): Promise<UploadedImageResult> => {
  const safeName =
    fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") ||
    `image-${Date.now()}.${guessExtension(uri, mimeType)}`;
  const path = `${folder}/${Date.now()}-${safeName}`;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: mimeType ?? blob.type ?? "image/jpeg",
      upsert: false,
    });

    if (error) {
      return {
        localUri: uri,
        fileName: safeName,
        remoteUrl: null,
        error: error.message,
      };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      localUri: uri,
      fileName: safeName,
      remoteUrl: data.publicUrl ?? null,
      error: null,
    };
  } catch (error) {
    return {
      localUri: uri,
      fileName: safeName,
      remoteUrl: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to upload image right now.",
    };
  }
};

export const isNativeImagePickerAvailable = Platform.OS !== "web";
