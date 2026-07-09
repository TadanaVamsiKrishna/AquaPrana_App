
import { useState } from "react";
import { saveProfile } from "../services/profile";
import {
  KeyboardAvoidingView,
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#0A84FF",
  background: "#F4FAFF",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6E4F0",
  softBlue: "#EAF5FF",
  error: "#DC2626",
  disabled: "#B8D8F6",
  shadow: "#0A4F9E",
};

type PickerField = "state" | "district" | "language";

const pickerOptions: Record<PickerField, string[]> = {
  state:[
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry"
    ],
  district: [
    "Alluri Sitharama Raju",
    "Anakapalli",
    "Annamayya",
    "Ananthapuramu",
    "Bapatla",
    "Chittoor",
    "Dr. B.R. Ambedkar Konaseema",
    "East Godavari",
    "Eluru",
    "Guntur",
    "Kakinada",
    "Krishna",
    "Kurnool",
    "Nandyal",
    "NTR",
    "Palnadu",
    "Parvathipuram Manyam",
    "Prakasam",
    "Sri Potti Sriramulu Nellore",
    "Sri Sathya Sai",
    "Srikakulam",
    "Tirupati",
    "Visakhapatnam",
    "Vizianagaram",
    "West Godavari",
    "YSR Kadapa"
    ],
  language: ["English", "Telugu", "Hindi"],
};

export default function FarmerProfileScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [district, setDistrict] = useState("");
  const [language, setLanguage] = useState("");
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [touched, setTouched] = useState({
    name: false,
    state: false,
    district: false,
    language: false,
  });

  const isFormValid =
    name.trim().length > 0 &&
    selectedState.trim().length > 0 &&
    district.trim().length > 0 &&
    language.trim().length > 0;

  const markTouched = (field: keyof typeof touched) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const getPickerValue = (field: PickerField) => {
    if (field === "state") {
      return selectedState;
    }

    if (field === "district") {
      return district;
    }

    return language;
  };

  const showPickerError = (field: PickerField, value: string) =>
    touched[field] && !value && activePicker !== field;

  const blurPicker = (field: PickerField) => {
    if (!getPickerValue(field)) {
      markTouched(field);
    }
  };

  const isSearchablePicker = (field: PickerField) =>
    field === "state" || field === "district";

  const getFilteredOptions = (field: PickerField) => {
    const options = pickerOptions[field];

    if (!isSearchablePicker(field) || !pickerSearchQuery.trim()) {
      return options;
    }

    const query = pickerSearchQuery.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(query));
  };

  const openPicker = (field: PickerField) => {
    if (activePicker === field) {
      setPickerSearchQuery("");
      blurPicker(field);
      setActivePicker(null);
      return;
    }

    if (activePicker !== null) {
      blurPicker(activePicker);
    }

    setPickerSearchQuery("");
    setActivePicker(field);
  };

  const handlePickerSelect = (value: string) => {
    if (activePicker === "state") {
      setSelectedState(value);
    }

    if (activePicker === "district") {
      setDistrict(value);
    }

    if (activePicker === "language") {
      setLanguage(value);
    }

    setPickerSearchQuery("");
    setActivePicker(null);
  };

  const handleSaveProfile = async () => {
    if (activePicker !== null) {
      blurPicker(activePicker);
      setActivePicker(null);
      setPickerSearchQuery("");
    }
  
    if (!isFormValid) {
      setTouched({
        name: true,
        state: true,
        district: true,
        language: true,
      });
      return;
    }
  
    const { data, error } = await saveProfile(
      name,
      selectedState,
      district,
      language
    );
  
    console.log("Profile Data:", data);
    console.log("Profile Error:", error);
  
    if (error) {
      alert(error.message);
      return;
    }
  
    router.replace("/pond-setup");
  };


  const renderDropdown = (field: PickerField, selectedValue: string) => {
    if (activePicker !== field) {
      return null;
    }

    const filteredOptions = getFilteredOptions(field);
    const showSearch = isSearchablePicker(field);

    return (
      <View style={styles.dropdownMenu}>
        {showSearch ? (
          <View style={styles.dropdownSearchWrap}>
            <Feather name="search" size={18} color={colors.muted} />
            <TextInput
              value={pickerSearchQuery}
              onChangeText={setPickerSearchQuery}
              placeholder={`Search ${field}...`}
              placeholderTextColor={colors.muted}
              style={styles.dropdownSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {pickerSearchQuery.length > 0 ? (
              <Pressable
                onPress={() => setPickerSearchQuery("")}
                hitSlop={8}
                accessibilityLabel={`Clear ${field} search`}
              >
                <Feather name="x" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          style={showSearch ? styles.dropdownScroll : undefined}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {filteredOptions.length === 0 ? (
            <View style={styles.dropdownEmpty}>
              <Text style={styles.dropdownEmptyText}>No results found</Text>
            </View>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = selectedValue === option;
              const isLastOption = index === filteredOptions.length - 1;

              return (
                <Pressable
                  key={option}
                  onPress={() => handlePickerSelect(option)}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    isSelected && styles.dropdownOptionSelected,
                    isLastOption && styles.dropdownOptionLast,
                    pressed && styles.dropdownOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      isSelected && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>

                  {isSelected ? (
                    <Feather name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.brandText}>AquaPrana</Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dropCircle}>
                <Feather name="droplet" size={16} color={colors.primary} />
              </View>
              <View style={styles.dividerLine} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardIconCircle}>
                <Feather name="user" size={22} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Your Details</Text>
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Feather name="user" size={18} color={colors.primary} />
                <Text style={styles.fieldLabel}>Name</Text>
              </View>

              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={() => markTouched("name")}
                placeholder="Enter your name"
                placeholderTextColor={colors.muted}
                style={[
                  styles.inputControl,
                  touched.name && !name.trim() && styles.inputError,
                ]}
                autoCapitalize="words"
                returnKeyType="done"
              />

              {touched.name && !name.trim() ? (
                <Text style={styles.errorText}>Name is required</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Feather name="map-pin" size={18} color={colors.primary} />
                <Text style={styles.fieldLabel}>State</Text>
              </View>

              <Pressable
                onPress={() => openPicker("state")}
                style={[
                  styles.selectControl,
                  activePicker === "state" && styles.selectControlActive,
                  showPickerError("state", selectedState) && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectText,
                    !selectedState && styles.placeholderText,
                  ]}
                >
                  {selectedState || "Select state"}
                </Text>

                <Feather
                  name={
                    activePicker === "state" ? "chevron-up" : "chevron-down"
                  }
                  size={20}
                  color={
                    activePicker === "state" ? colors.primary : colors.muted
                  }
                />
              </Pressable>

              {renderDropdown("state", selectedState)}

              {showPickerError("state", selectedState) ? (
                <Text style={styles.errorText}>State is required</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Feather name="home" size={18} color={colors.primary} />
                <Text style={styles.fieldLabel}>District</Text>
              </View>

              <Pressable
                onPress={() => openPicker("district")}
                style={[
                  styles.selectControl,
                  activePicker === "district" && styles.selectControlActive,
                  showPickerError("district", district) && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectText,
                    !district && styles.placeholderText,
                  ]}
                >
                  {district || "Select district"}
                </Text>

                <Feather
                  name={
                    activePicker === "district" ? "chevron-up" : "chevron-down"
                  }
                  size={20}
                  color={
                    activePicker === "district" ? colors.primary : colors.muted
                  }
                />
              </Pressable>

              {renderDropdown("district", district)}

              {showPickerError("district", district) ? (
                <Text style={styles.errorText}>District is required</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Feather name="globe" size={18} color={colors.primary} />
                <Text style={styles.fieldLabel}>Language</Text>
              </View>

              <Pressable
                onPress={() => openPicker("language")}
                style={[
                  styles.selectControl,
                  activePicker === "language" && styles.selectControlActive,
                  showPickerError("language", language) && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectText,
                    !language && styles.placeholderText,
                  ]}
                >
                  {language || "Select language"}
                </Text>

                <Feather
                  name={
                    activePicker === "language" ? "chevron-up" : "chevron-down"
                  }
                  size={20}
                  color={
                    activePicker === "language" ? colors.primary : colors.muted
                  }
                />
              </Pressable>

              {renderDropdown("language", language)}

              {showPickerError("language", language) ? (
                <Text style={styles.errorText}>Language is required</Text>
              ) : null}
            </View>

            <Pressable
              onPress={handleSaveProfile}
              style={({ pressed }) => [
                styles.saveButton,
                !isFormValid && styles.saveButtonDisabled,
                pressed && styles.saveButtonPressed,
              ]}
            >
              <Feather name="save" size={19} color={colors.white} />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 30,
  },
  header: {
    alignItems: "center",
    marginBottom: 26,
  },
  welcomeText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  brandText: {
    color: colors.primary,
    fontSize: 42,
    lineHeight: 50,
    fontWeight: "900",
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  dividerLine: {
    width: 62,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.32,
  },
  dropCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  fieldBlock: {
    marginBottom: 17,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginLeft: 8,
  },
  inputControl: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  selectControl: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectControlActive: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.error,
  },
  selectText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  placeholderText: {
    color: colors.muted,
    fontWeight: "500",
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },
  saveButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    marginLeft: 10,
  },
  dropdownMenu: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  dropdownSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    gap: 10,
  },
  dropdownSearchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownEmpty: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownEmptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownOption: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.softBlue,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionPressed: {
    backgroundColor: colors.background,
  },
  dropdownOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
  },
});
