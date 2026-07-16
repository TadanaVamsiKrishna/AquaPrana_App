import { useCallback, useMemo, useState } from "react";
import {
  getInventoryItems,
  restockInventoryItem,
} from "../services/inventory";
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
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../components/bottom-nav";

interface InventoryItem {
  id: string;
  product_name: string;
  unit: string;
  current_qty: number;
  restock_threshold: number;
  restock_qty: number;
  location: string | null;
}
const colors = {
  primary: "#0A84FF",
  primaryDark: "#004A9F",
  background: "#F2F5F8",
  white: "#FFFFFF",
  text: "#0B3A6E",
  textDark: "#1F2937",
  muted: "#6B7280",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  shadow: "#0A4F9E",
};

function getCategoryIcon(): keyof typeof Feather.glyphMap {
  return "package";
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function UrgentItemRow({
  item,
  onRestock,
}: {
  item: InventoryItem;
  onRestock: (id: string) => void;
}) {
  return (
    <View style={styles.urgentRow}>
      <View style={styles.urgentAccent} />
      <View style={styles.urgentCopy}>
        <Text style={styles.urgentName}>{item.product_name}</Text>
        <Text style={styles.urgentMeta}>
  {item.current_qty} {item.unit} / {item.restock_threshold} {item.unit}
</Text>
      </View>
      <Pressable
        onPress={() => onRestock(item.id)}
        style={({ pressed }) => [
          styles.urgentRestockButton,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
      >
        <Text style={styles.urgentRestockText}>Restock</Text>
      </Pressable>
    </View>
  );
}

function InventoryCard({
  item,
  onRestock,
  onEdit,
}: {
  item: InventoryItem;
  onRestock: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const low =
  item.current_qty <= item.restock_threshold;

  return (
    <View style={styles.inventoryCard}>
      <View style={styles.inventoryCardHeader}>
        <View style={styles.inventoryIdentity}>
          <View style={styles.categoryIcon}>
          <Feather
          name="package"
          size={16}
          color={colors.primary}
        />
          </View>
          <View style={styles.inventoryIdentityCopy}>
                <Text style={styles.categoryLabel}>
        Inventory Item
      </Text>
            <Text style={styles.productName}>{item.product_name}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            low ? styles.statusBadgeLow : styles.statusBadgeOk,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              low ? styles.statusBadgeTextLow : styles.statusBadgeTextOk,
            ]}
          >
            {low ? "Low Stock" : "In Stock"}
          </Text>
        </View>
      </View>

      <Text style={styles.quantityValue}>
        {item.current_qty} {item.unit}
      </Text>

      {item.location ? (
        <Text style={styles.locationText}>{item.location}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <Pressable
          onPress={() => onRestock(item.id)}
          style={({ pressed }) => [
            styles.restockButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.restockButtonText}>Restock</Text>
        </Pressable>

              <Pressable
        onPress={() => onEdit(item.id)}
        style={({ pressed }) => [
          styles.editButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
            </View>
          </View>
        );
      }

export default function InventoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleEdit = (id: string) => {
    router.push({
      pathname: "/edit-inventory",
      params: { id },
    });
  };

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    const saved = await getInventoryItems();
  setItems(saved ?? []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const lowStockItems = useMemo(
    () =>
      items.filter(
        (item) => item.current_qty <= item.restock_threshold
      ),
    [items]
  );
  
  const totalItems = useMemo(
    () => items.length,
    [items]
  );

  const handleRestock = async (id: string) => {
    try {
      await restockInventoryItem(id);
      await loadItems();
      Alert.alert(t("common.success"), t("inventory.restocked"));
    } catch (error) {
      Alert.alert(t("common.error"), t("inventory.restockFailed"));
      console.log(error);
    }
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace("/home" as never)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>{t("inventory.title")}</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t("inventory.title")}</Text>
              <Text style={styles.heroSubtitle}>{t("inventory.subtitle")}</Text>
            </View>

            <Pressable
              onPress={() => router.push("/add-inventory" as never)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.addButtonText}>{t("inventory.add")}</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconWrap}>
                <Feather name="package" size={16} color={colors.primary} />
              </View>
              <Text style={styles.summaryLabel}>{t("inventory.totalItems")}</Text>
              <Text style={styles.summaryValue}>{formatCount(totalItems)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconWrap, styles.summaryIconDanger]}>
                <Feather name="alert-triangle" size={16} color={colors.danger} />
              </View>
              <Text style={styles.summaryLabel}>{t("inventory.lowStockCount")}</Text>
              <Text style={[styles.summaryValue, styles.summaryValueDanger]}>
                {lowStockItems.length}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {lowStockItems.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Feather
                      name="alert-circle"
                      size={16}
                      color={colors.danger}
                    />
                    <Text style={styles.urgentSectionTitle}>{t("inventory.urgentAttention")}</Text>
                  </View>

                  <View style={styles.urgentList}>
                    {lowStockItems.map((item) => (
                      <UrgentItemRow
                        key={item.id}
                        item={item}
                        onRestock={handleRestock}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeaderSpaced}>
                  <Text style={styles.sectionTitle}>{t("inventory.currentInventory")}</Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(t("inventory.filterSoonTitle"), t("inventory.filterSoonMessage"))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("inventory.openFilter")}
                  >
                    <Feather name="filter" size={18} color={colors.muted} />
                  </Pressable>
                </View>

                {items.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Feather name="package" size={26} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>{t("inventory.noInventory")}</Text>
                    <Text style={styles.emptySubtitle}>
                      {t("inventory.noInventoryHint")}
                    </Text>
                  </View>
                ) : (
                  items.map((item) => (
                    <InventoryCard
                    key={item.id}
                    item={item}
                    onRestock={handleRestock}
                    onEdit={handleEdit}
                  />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>

        <BottomNav activeTab="inventory" />
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 2,
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  summaryIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  summaryValue: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryValueDanger: {
    color: colors.danger,
  },
  loadingState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeaderSpaced: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  urgentSectionTitle: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.textDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  urgentList: {
    gap: 8,
  },
  urgentRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minHeight: 64,
  },
  urgentAccent: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: colors.danger,
  },
  urgentCopy: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urgentName: {
    color: colors.textDark,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  urgentMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  urgentRestockButton: {
    marginRight: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  urgentRestockText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  inventoryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 4,
  },
  inventoryCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  inventoryIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
    gap: 10,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryIdentityCopy: {
    flex: 1,
  },
  categoryLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  productName: {
    color: colors.textDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeOk: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeLow: {
    backgroundColor: colors.dangerSoft,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  statusBadgeTextOk: {
    color: colors.success,
  },
  statusBadgeTextLow: {
    color: colors.danger,
  },
  quantityValue: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginBottom: 4,
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  restockButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  restockButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  editButton: {
    width: 84,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.textDark,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
