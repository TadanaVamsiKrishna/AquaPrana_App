import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  pickImageFromCamera,
  pickImagesFromGallery,
  pickSingleImage,
  promptImageSource,
  uploadImageToSupabaseStorage,
} from "../lib/record-images";

const colors = {
  primary: "#0A84FF",
  background: "#F4FAFF",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6E4F0",
  softBlue: "#EAF5FF",
  paleBlue: "#F8FCFF",
  success: "#22C55E",
  softGreen: "#E8F8EE",
  shadow: "#0A4F9E",
};

type RecordOption = "upload" | "manual" | "none";

type RecordImage = {
  id: string;
  uri: string;
  fileName: string;
  remoteUrl?: string | null;
};

type RecordOptionConfig = {
  id: RecordOption;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconBackground: string;
  iconColor: string;
};

const recordOptions: RecordOptionConfig[] = [
  {
    id: "upload",
    title: "Upload past records",
    description: "Upload photos of your passbook, feed register or logbook.",
    icon: "camera",
    iconBackground: colors.softBlue,
    iconColor: colors.primary,
  },
  {
    id: "manual",
    title: "Enter summary manually",
    description: "Enter total feed, mortality and other key information.",
    icon: "file-text",
    iconBackground: colors.softGreen,
    iconColor: colors.success,
  },
  {
    id: "none",
    title: "No records available",
    description: "Start from today. You can add past data later.",
    icon: "calendar",
    iconBackground: colors.softBlue,
    iconColor: colors.primary,
  },
];

function RadioButton({ selected }: { selected: boolean }) {
  return (
    <View
      style={[styles.radioOuter, selected && styles.radioOuterSelected]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

const createImageId = (uri: string) => `${uri}-${Date.now()}-${Math.random()}`;

export default function JoinExistingCycleScreen() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<RecordOption>("upload");
  const [recordImages, setRecordImages] = useState<RecordImage[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleOptionSelect = (option: RecordOption) => {
    setSelectedOption(option);
  };

  const appendImages = (
    images: { uri: string; fileName?: string | null; remoteUrl?: string | null }[],
  ) => {
    setRecordImages((current) => [
      ...current,
      ...images.map((image) => ({
        id: createImageId(image.uri),
        uri: image.uri,
        fileName: image.fileName || image.uri.split("/").pop() || "image.jpg",
        remoteUrl: image.remoteUrl ?? null,
      })),
    ]);
  };

  const handleTakePhoto = async () => {
    setIsPicking(true);
    try {
      const uris = await pickImageFromCamera();
      if (uris) {
        appendImages(uris.map((uri) => ({ uri })));
      }
    } catch (error) {
      Alert.alert(
        "Camera error",
        error instanceof Error ? error.message : "Unable to open camera.",
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleChooseGallery = async () => {
    setIsPicking(true);
    try {
      const uris = await pickImagesFromGallery();
      if (uris) {
        appendImages(uris.map((uri) => ({ uri })));
      }
    } catch (error) {
      Alert.alert(
        "Gallery error",
        error instanceof Error ? error.message : "Unable to open gallery.",
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleUploadButtonPress = () => {
    if (recordImages.length === 0) {
      promptImageSource(async (source) => {
        setIsPicking(true);
        try {
          const picked = await pickSingleImage(source);
          if (picked) {
            appendImages([picked]);
          }
        } catch (error) {
          Alert.alert(
            "Picker error",
            error instanceof Error ? error.message : "Unable to pick image.",
          );
        } finally {
          setIsPicking(false);
        }
      });
      return;
    }

    void handleUploadRecords();
  };

  const handleRemoveImage = (id: string) => {
    setRecordImages((current) => current.filter((image) => image.id !== id));
  };

  const handleUploadRecords = async () => {
    if (recordImages.length === 0) {
      Alert.alert("No images", "Select at least one image before uploading.");
      return;
    }

    setIsUploading(true);

    try {
      const uploaded = await Promise.all(
        recordImages.map(async (image) => {
          if (image.remoteUrl) {
            return image;
          }

          const result = await uploadImageToSupabaseStorage({
            uri: image.uri,
            fileName: image.fileName,
            folder: "existing-cycle-records",
          });

          return {
            ...image,
            remoteUrl: result.remoteUrl,
          };
        }),
      );

      setRecordImages(uploaded);

      const uploadedCount = uploaded.filter((image) => image.remoteUrl).length;
      const localOnlyCount = uploaded.length - uploadedCount;

      if (uploadedCount > 0 && localOnlyCount === 0) {
        Alert.alert(
          "Upload complete",
          `${uploadedCount} image${uploadedCount === 1 ? "" : "s"} uploaded successfully.`,
        );
      } else if (uploadedCount > 0) {
        Alert.alert(
          "Partially uploaded",
          `${uploadedCount} uploaded to storage. ${localOnlyCount} kept locally because storage upload failed.`,
        );
      } else {
        Alert.alert(
          "Saved locally",
          "Images are ready on this device. Supabase Storage upload was unavailable, so remote URLs were not created.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : "Unable to upload images.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color={colors.primary} />
          </Pressable>

          <Text style={styles.headerTitle}>Join Existing Cycle</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Do you have previous records?</Text>

          <View
            style={styles.optionsBlock}
            accessibilityRole="radiogroup"
            accessibilityLabel="Previous records options"
          >
            {recordOptions.map((option) => {
              const isSelected = selectedOption === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleOptionSelect(option.id)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    pressed && styles.optionCardPressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.title}
                >
                  <RadioButton selected={isSelected} />

                  <View
                    style={[
                      styles.optionIconCircle,
                      { backgroundColor: option.iconBackground },
                    ]}
                  >
                    <Feather
                      name={option.icon}
                      size={20}
                      color={option.iconColor}
                    />
                  </View>

                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>

                  <Feather name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>

          {selectedOption === "upload" ? (
            <View style={styles.uploadSection}>
              <Text style={styles.sectionTitle}>Upload your records</Text>

              <View style={styles.uploadCard}>
                {recordImages.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.previewRow}
                  >
                    {recordImages.map((image) => (
                      <View key={image.id} style={styles.previewItem}>
                        <Image
                          source={{ uri: image.uri }}
                          style={styles.previewImage}
                          contentFit="cover"
                        />
                        <Text style={styles.previewFileName} numberOfLines={1}>
                          {image.fileName}
                        </Text>
                        <Pressable
                          onPress={() => handleRemoveImage(image.id)}
                          style={({ pressed }) => [
                            styles.removeImageButton,
                            pressed && styles.removeImageButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Remove photo"
                        >
                          <Feather name="x" size={14} color={colors.white} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.uploadIconCircle}>
                    <Feather
                      name="upload-cloud"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                )}

                <Text style={styles.uploadHint}>
                  Take a photo or choose from gallery
                </Text>

                <Pressable
                  onPress={handleTakePhoto}
                  disabled={isPicking || isUploading}
                  style={({ pressed }) => [
                    styles.takePhotoButton,
                    pressed && styles.takePhotoButtonPressed,
                    (isPicking || isUploading) && styles.buttonDisabled,
                  ]}
                  accessibilityRole="button"
                >
                  {isPicking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Feather name="camera" size={18} color={colors.white} />
                      <Text style={styles.takePhotoButtonText}>Take Photo</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleChooseGallery}
                  disabled={isPicking || isUploading}
                  style={({ pressed }) => [
                    styles.galleryButton,
                    pressed && styles.galleryButtonPressed,
                    (isPicking || isUploading) && styles.buttonDisabled,
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="image" size={18} color={colors.primary} />
                  <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
                </Pressable>

                <Pressable
                  onPress={handleUploadButtonPress}
                  disabled={isPicking || isUploading}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    pressed && styles.uploadButtonPressed,
                    (isPicking || isUploading) && styles.buttonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload selected photos"
                >
                  {isUploading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Feather name="upload" size={18} color={colors.white} />
                      <Text style={styles.uploadButtonText}>
                        {recordImages.length === 0
                          ? "Upload"
                          : `Upload (${recordImages.length})`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoIconCircle}>
              <Feather name="zap" size={18} color={colors.primary} />
            </View>

            <Text style={styles.infoText}>
              Our AI will read your records and import the data automatically.
            </Text>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "AI Import",
                  "Upload clear photos of your records and AquaPrana will extract key data for you.",
                )
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="More information"
            >
              <Feather name="info" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </ScrollView>

        {selectedOption === "manual" ? (
          <View style={styles.footer}>
            <Pressable
              onPress={() => router.push("/manual-cycle-summary" as never)}
              style={({ pressed }) => [
                styles.takePhotoButton,
                pressed && styles.takePhotoButtonPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.takePhotoButtonText}>
                Continue to Manual Summary
              </Text>
            </Pressable>
          </View>
        ) : null}

        {selectedOption === "none" ? (
          <View style={styles.footer}>
            <Pressable
              onPress={() => router.replace("/home" as never)}
              style={({ pressed }) => [
                styles.takePhotoButton,
                pressed && styles.takePhotoButtonPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.takePhotoButtonText}>Continue to Home</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  backButtonPressed: {
    opacity: 0.82,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 14,
  },
  optionsBlock: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.paleBlue,
    shadowOpacity: 0.08,
    elevation: 4,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionCopy: {
    flex: 1,
    paddingRight: 8,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    marginBottom: 3,
  },
  optionDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
  },
  previewRow: {
    gap: 10,
    paddingBottom: 14,
  },
  previewItem: {
    width: 96,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.paleBlue,
  },
  previewImage: {
    width: "100%",
    height: 84,
  },
  previewFileName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(31, 41, 55, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageButtonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadHint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
  },
  takePhotoButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  takePhotoButtonPressed: {
    opacity: 0.9,
  },
  takePhotoButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginLeft: 8,
  },
  galleryButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryButtonPressed: {
    opacity: 0.88,
  },
  galleryButtonText: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginLeft: 8,
  },
  uploadButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  uploadButtonPressed: {
    opacity: 0.9,
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: colors.softBlue,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginRight: 10,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: colors.background,
  },
});
