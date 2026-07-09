import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

const PERMISSION_ALERT =
  "Camera permission is required to upload records.";

export const requestCameraPermission = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== "granted") {
    Alert.alert(PERMISSION_ALERT);
    return false;
  }

  return true;
};

export const requestMediaLibraryPermission = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    Alert.alert(PERMISSION_ALERT);
    return false;
  }

  return true;
};

export const pickImageFromCamera = async () => {
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

export const pickImagesFromGallery = async () => {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets.map((asset) => asset.uri);
};
