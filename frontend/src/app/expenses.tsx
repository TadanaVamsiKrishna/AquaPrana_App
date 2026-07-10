import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/bottom-nav";
import {
  formatCurrency,
  formatPriceLabel,
  parsePriceValue,
  sanitizeDecimalInput,
} from "../lib/expense-format";
import {
  getFarmerPriceConfig,
  hasConfiguredFarmerPrices,
  saveFarmerPriceConfig,
  type FarmerPriceConfig,
} from "../services/farmer-price-config";
import {
  calculateLineExpenseTotals,
  type ExpensePriceMode,
  type TreatmentProduct,
} from "../services/local-pond-expenses";
import {
  getPondExpenseRecord,
  priceInputValue,
  resolveCycleId,
  savePondExpenseRecord,
  type PondExpenseRecord,
} from "../services/pond-expenses";
import {
  getPonds,
  resolvePondName,
  type StoredPond,
} from "../services/local-ponds";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  warningSoft: "#FEF3C7",
  warningText: "#B45309",
};

type ScreenTab = "prices" | "tracking";

const createProduct = (): TreatmentProduct => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  unit: "Litre",
  price: 0,
});

const averageTreatmentPrice = (products: TreatmentProduct[]) => {
  const priced = products.filter((product) => parsePriceValue(product.price) > 0);
  if (priced.length === 0) {
    return 0;
  }
  const sum = priced.reduce(
    (total, product) => total + parsePriceValue(product.price),
    0,
  );
  return sum / priced.length;
};

export default function ExpensesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ScreenTab>("prices");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [isSavingPond, setIsSavingPond] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ponds, setPonds] = useState<StoredPond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string | null>(null);
  const [priceMode, setPriceMode] = useState<ExpensePriceMode>("fixed");
  const [savedGlobalConfig, setSavedGlobalConfig] =
    useState<FarmerPriceConfig | null>(null);

  const [feedPrice, setFeedPrice] = useState("");
  const [seedPrice, setSeedPrice] = useState("");
  const [labourPrice, setLabourPrice] = useState("");
  const [products, setProducts] = useState<TreatmentProduct[]>([createProduct()]);
  const [productPriceInputs, setProductPriceInputs] = useState<
    Record<string, string>
  >({});

  const [manualFeedPrice, setManualFeedPrice] = useState("");
  const [manualSeedPrice, setManualSeedPrice] = useState("");
  const [manualTreatmentPrice, setManualTreatmentPrice] = useState("");

  const [feedQty, setFeedQty] = useState("");
  const [seedQty, setSeedQty] = useState("");
  const [treatmentQty, setTreatmentQty] = useState("");

  const activePonds = useMemo(
    () => ponds.filter((pond) => !pond.archived),
    [ponds],
  );

  const selectedPond =
    activePonds.find((pond) => pond.id === selectedPondId) ?? activePonds[0] ?? null;

  const globalFormConfig: FarmerPriceConfig = useMemo(
    () => ({
      feedPricePerKg: parsePriceValue(feedPrice),
      seedPricePerThousand: parsePriceValue(seedPrice),
      labourCostPerDay: parsePriceValue(labourPrice),
      treatmentProducts: products.map((product) => ({
        ...product,
        price: parsePriceValue(
          productPriceInputs[product.id] ?? String(product.price ?? ""),
        ),
      })),
    }),
    [feedPrice, seedPrice, labourPrice, products, productPriceInputs],
  );

  const activeGlobalConfig = savedGlobalConfig ?? globalFormConfig;

  const appliedFeedPrice =
    priceMode === "fixed"
      ? activeGlobalConfig.feedPricePerKg
      : parsePriceValue(manualFeedPrice);
  const appliedSeedPrice =
    priceMode === "fixed"
      ? activeGlobalConfig.seedPricePerThousand
      : parsePriceValue(manualSeedPrice);
  const appliedTreatmentPrice =
    priceMode === "fixed"
      ? averageTreatmentPrice(activeGlobalConfig.treatmentProducts)
      : parsePriceValue(manualTreatmentPrice);

  const totals = useMemo(
    () =>
      calculateLineExpenseTotals({
        feedKg: Number(feedQty) || 0,
        seedCount: Number(seedQty) || 0,
        treatmentQty: Number(treatmentQty) || 0,
        feedPricePerKg: appliedFeedPrice,
        seedPricePerThousand: appliedSeedPrice,
        treatmentPrice: appliedTreatmentPrice,
      }),
    [
      feedQty,
      seedQty,
      treatmentQty,
      appliedFeedPrice,
      appliedSeedPrice,
      appliedTreatmentPrice,
    ],
  );

  const applyGlobalConfigToForm = useCallback((config: FarmerPriceConfig) => {
    setSavedGlobalConfig(config);
    setFeedPrice(priceInputValue(config.feedPricePerKg));
    setSeedPrice(priceInputValue(config.seedPricePerThousand));
    setLabourPrice(priceInputValue(config.labourCostPerDay));
    const nextProducts =
      config.treatmentProducts?.length > 0
        ? config.treatmentProducts
        : [createProduct()];
    setProducts(nextProducts);
    setProductPriceInputs(
      Object.fromEntries(
        nextProducts.map((product) => [
          product.id,
          priceInputValue(parsePriceValue(product.price)),
        ]),
      ),
    );
  }, []);

  const loadPondExpense = useCallback(
    async (pond: StoredPond, farmerConfig: FarmerPriceConfig) => {
      const cycleId = resolveCycleId(pond.stockingDate);
      const { record, error } = await getPondExpenseRecord(pond.id, cycleId);

      if (error) {
        setLoadError((current) => current ?? error);
      }

      const mode = record?.priceMode === "manual" ? "manual" : "fixed";
      setPriceMode(mode);

      setFeedQty(
        record?.quantities.feedKg != null
          ? priceInputValue(record.quantities.feedKg)
          : "",
      );
      setSeedQty(
        record?.quantities.seedCount != null
          ? priceInputValue(record.quantities.seedCount)
          : "",
      );
      setTreatmentQty(
        record?.quantities.treatmentQty != null
          ? priceInputValue(record.quantities.treatmentQty)
          : "",
      );

      if (mode === "manual" && record) {
        setManualFeedPrice(priceInputValue(record.prices.feedPricePerKg));
        setManualSeedPrice(priceInputValue(record.prices.seedPricePerThousand));
        setManualTreatmentPrice(
          priceInputValue(record.prices.treatmentPricePerUnit),
        );
      } else {
        setManualFeedPrice(priceInputValue(farmerConfig.feedPricePerKg));
        setManualSeedPrice(priceInputValue(farmerConfig.seedPricePerThousand));
        setManualTreatmentPrice(
          priceInputValue(averageTreatmentPrice(farmerConfig.treatmentProducts)),
        );
      }
    },
    [],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [pondList, priceResult] = await Promise.all([
        getPonds(),
        getFarmerPriceConfig(),
      ]);

      setPonds(pondList);
      applyGlobalConfigToForm(priceResult.config);

      if (priceResult.error) {
        setLoadError(priceResult.error);
      }

      const nextPonds = pondList.filter((pond) => !pond.archived);

      setSelectedPondId((current) => {
        const nextPond =
          (current && nextPonds.find((pond) => pond.id === current)) ||
          nextPonds[0] ||
          null;

        if (nextPond) {
          void loadPondExpense(nextPond, priceResult.config);
        }

        return nextPond?.id ?? null;
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load expenses",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyGlobalConfigToForm, loadPondExpense]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updateProduct = (id: string, patch: Partial<TreatmentProduct>) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    );
  };

  const removeProduct = (id: string) => {
    setProducts((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== id),
    );
  };

  const handleSaveGlobalPrices = async () => {
    if (parsePriceValue(feedPrice) <= 0) {
      Alert.alert("Feed price required", "Enter Feed Price (₹/kg) before saving.");
      return;
    }

    setIsSavingPrices(true);
    const result = await saveFarmerPriceConfig(globalFormConfig);
    setIsSavingPrices(false);

    if (result.config) {
      applyGlobalConfigToForm(result.config);
    }

    if (result.error) {
      Alert.alert("Saved with warning", result.error);
      return;
    }

    Alert.alert(
      "Prices saved",
      "Global price configuration is shared across all ponds.",
    );
  };

  const handleSelectPond = async (pondId: string) => {
    const pond = activePonds.find((item) => item.id === pondId);
    if (!pond) {
      return;
    }

    setSelectedPondId(pondId);
    await loadPondExpense(pond, activeGlobalConfig);
  };

  const handleSavePondExpenses = async () => {
    if (!selectedPond) {
      Alert.alert("No pond selected", "Add a pond before tracking expenses.");
      return;
    }

    if (priceMode === "fixed" && !hasConfiguredFarmerPrices(activeGlobalConfig)) {
      Alert.alert(
        "Configure prices first",
        "Save global prices, or switch to Enter prices manually.",
      );
      setActiveTab("prices");
      return;
    }

    const feedKg = parsePriceValue(feedQty);
    const seedCount = parsePriceValue(seedQty);
    const treatmentAmount = parsePriceValue(treatmentQty);

    if (feedKg <= 0 && seedCount <= 0 && treatmentAmount <= 0) {
      Alert.alert(
        "Missing quantities",
        "Enter at least one quantity for feed, seed, or treatment.",
      );
      return;
    }

    if (priceMode === "manual") {
      if (feedKg > 0 && appliedFeedPrice <= 0) {
        Alert.alert("Feed price required", "Enter a feed price for this pond.");
        return;
      }
      if (seedCount > 0 && appliedSeedPrice <= 0) {
        Alert.alert("Seed price required", "Enter a seed price for this pond.");
        return;
      }
      if (treatmentAmount > 0 && appliedTreatmentPrice <= 0) {
        Alert.alert(
          "Treatment price required",
          "Enter a treatment/mineral price for this pond.",
        );
        return;
      }
    }

    setIsSavingPond(true);

    try {
      const cycleId = resolveCycleId(selectedPond.stockingDate);
      const treatmentProducts =
        priceMode === "manual"
          ? [
              {
                id: createProduct().id,
                name: "Treatment / Mineral",
                unit: "Unit",
                price: appliedTreatmentPrice,
              },
            ]
          : activeGlobalConfig.treatmentProducts;

      const record: PondExpenseRecord = {
        pondId: selectedPond.id,
        cycleId,
        priceMode,
        quantities: {
          feedKg,
          seedCount,
          treatmentQty: treatmentAmount,
        },
        prices: {
          feedPricePerKg: appliedFeedPrice,
          seedPricePerThousand: appliedSeedPrice,
          treatmentPricePerUnit: appliedTreatmentPrice,
          labourCostPerDay: activeGlobalConfig.labourCostPerDay,
        },
        treatmentProducts,
        manualExpenses: [],
        feed: totals.feed,
        seed: totals.seed,
        treatment: totals.treatment,
        labour: 0,
        others: 0,
        total: totals.total,
        configured: true,
      };

      const result = await savePondExpenseRecord(record);

      if (result.error) {
        Alert.alert("Saved with warning", result.error);
      } else {
        Alert.alert(
          "Expenses saved",
          `Saved for ${resolvePondName(selectedPond)}. Dashboard expense summary is updated.`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Could not save pond expenses.",
      );
    } finally {
      setIsSavingPond(false);
    }
  };

  const renderPriceConfig = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.infoBanner}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={styles.infoBannerText}>
          Set prices once for your farm. These apply to every pond when “Use fixed
          prices” is selected.
        </Text>
      </View>

      {loadError ? (
        <View style={styles.warningBanner}>
          <Feather name="alert-triangle" size={16} color={colors.warningText} />
          <Text style={styles.warningText}>{loadError}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Basic Prices</Text>
      <View style={styles.card}>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>
            Feed Price (₹/kg) <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputShell}>
            <TextInput
              value={feedPrice}
              onChangeText={(value) => setFeedPrice(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Seed / Fry Price (₹/1000 count)</Text>
          <View style={styles.inputShell}>
            <TextInput
              value={seedPrice}
              onChangeText={(value) => setSeedPrice(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Labour Cost (₹/day)</Text>
          <View style={styles.inputShell}>
            <TextInput
              value={labourPrice}
              onChangeText={(value) => setLabourPrice(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Treatment & Mineral Prices (Optional)</Text>
      {products.map((product, index) => (
        <View key={product.id} style={styles.card}>
          <View style={styles.productHeader}>
            <Text style={styles.productTitle}>Product {index + 1}</Text>
            {products.length > 1 ? (
              <Pressable onPress={() => removeProduct(product.id)}>
                <Feather name="trash-2" size={16} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={product.name}
                onChangeText={(value) => updateProduct(product.id, { name: value })}
                style={styles.input}
                placeholder="e.g. Probiotic"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={product.unit}
                  onChangeText={(value) =>
                    updateProduct(product.id, { unit: value })
                  }
                  style={styles.input}
                  placeholder="Litre"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Price (₹)</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={productPriceInputs[product.id] ?? ""}
                  onChangeText={(value) =>
                    setProductPriceInputs((current) => ({
                      ...current,
                      [product.id]: sanitizeDecimalInput(value),
                    }))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => {
          const product = createProduct();
          setProducts((current) => [...current, product]);
          setProductPriceInputs((current) => ({
            ...current,
            [product.id]: "",
          }));
        }}
        style={styles.outlineButton}
      >
        <Text style={styles.outlineButtonText}>+ Add Treatment / Mineral</Text>
      </Pressable>

      <Pressable
        onPress={handleSaveGlobalPrices}
        disabled={isSavingPrices}
        style={[styles.primaryButton, isSavingPrices && styles.buttonDisabled]}
      >
        <Feather name="save" size={16} color={colors.white} />
        <Text style={styles.primaryButtonText}>
          {isSavingPrices ? "Saving..." : "Save Global Prices"}
        </Text>
      </Pressable>
    </ScrollView>
  );

  const renderTracking = () => {
    if (activePonds.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="droplet" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No ponds yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a pond from Home before tracking pond expenses.
          </Text>
          <Pressable
            onPress={() => router.push("/pond-setup" as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>+ Add Pond</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Select Pond</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pondChipRow}
        >
          {activePonds.map((pond) => {
            const isActive = pond.id === selectedPond?.id;
            return (
              <Pressable
                key={pond.id}
                onPress={() => handleSelectPond(pond.id)}
                style={[styles.pondChip, isActive && styles.pondChipActive]}
              >
                <Text
                  style={[
                    styles.pondChipText,
                    isActive && styles.pondChipTextActive,
                  ]}
                >
                  {resolvePondName(pond)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Price Mode</Text>
        <View style={styles.modeRow}>
          {(
            [
              { id: "fixed", label: "Use fixed prices" },
              { id: "manual", label: "Enter prices manually" },
            ] as const
          ).map((option) => {
            const isActive = priceMode === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPriceMode(option.id)}
                style={[styles.modeChip, isActive && styles.modeChipActive]}
              >
                <Text
                  style={[styles.modeChipText, isActive && styles.modeChipTextActive]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {priceMode === "fixed" && !hasConfiguredFarmerPrices(activeGlobalConfig) ? (
          <View style={styles.warningBanner}>
            <Feather name="alert-triangle" size={16} color={colors.warningText} />
            <Text style={styles.warningText}>
              No global prices saved yet. Configure them in Global Prices, or switch
              to manual entry.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Expense Entry</Text>

        <View style={styles.card}>
          <Text style={styles.itemTitle}>Feed</Text>
          <View style={styles.rowFields}>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Quantity (kg)</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={feedQty}
                  onChangeText={(value) => setFeedQty(sanitizeDecimalInput(value))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Price (₹/kg)</Text>
              <View
                style={[
                  styles.inputShell,
                  priceMode === "fixed" && styles.inputDisabled,
                ]}
              >
                <TextInput
                  value={
                    priceMode === "fixed"
                      ? priceInputValue(appliedFeedPrice)
                      : manualFeedPrice
                  }
                  onChangeText={(value) =>
                    setManualFeedPrice(sanitizeDecimalInput(value))
                  }
                  editable={priceMode === "manual"}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
          {priceMode === "fixed" ? (
            <Text style={styles.appliedPrice}>
              Applied price: {formatPriceLabel(appliedFeedPrice, "kg")}
            </Text>
          ) : null}
          <Text style={styles.lineAmount}>
            Amount: {formatCurrency(totals.feed)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemTitle}>Seed</Text>
          <View style={styles.rowFields}>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Quantity (count)</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={seedQty}
                  onChangeText={(value) => setSeedQty(sanitizeDecimalInput(value))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Price (₹/1000)</Text>
              <View
                style={[
                  styles.inputShell,
                  priceMode === "fixed" && styles.inputDisabled,
                ]}
              >
                <TextInput
                  value={
                    priceMode === "fixed"
                      ? priceInputValue(appliedSeedPrice)
                      : manualSeedPrice
                  }
                  onChangeText={(value) =>
                    setManualSeedPrice(sanitizeDecimalInput(value))
                  }
                  editable={priceMode === "manual"}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
          {priceMode === "fixed" ? (
            <Text style={styles.appliedPrice}>
              Applied price: {formatPriceLabel(appliedSeedPrice, "1000")}
            </Text>
          ) : null}
          <Text style={styles.lineAmount}>
            Amount: {formatCurrency(totals.seed)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemTitle}>Treatment / Mineral</Text>
          <View style={styles.rowFields}>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={treatmentQty}
                  onChangeText={(value) =>
                    setTreatmentQty(sanitizeDecimalInput(value))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={[styles.fieldBlock, styles.flexField]}>
              <Text style={styles.label}>Price (₹/unit)</Text>
              <View
                style={[
                  styles.inputShell,
                  priceMode === "fixed" && styles.inputDisabled,
                ]}
              >
                <TextInput
                  value={
                    priceMode === "fixed"
                      ? priceInputValue(appliedTreatmentPrice)
                      : manualTreatmentPrice
                  }
                  onChangeText={(value) =>
                    setManualTreatmentPrice(sanitizeDecimalInput(value))
                  }
                  editable={priceMode === "manual"}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
          {priceMode === "fixed" ? (
            <Text style={styles.appliedPrice}>
              Applied price: {formatPriceLabel(appliedTreatmentPrice, "unit")}
            </Text>
          ) : null}
          <Text style={styles.lineAmount}>
            Amount: {formatCurrency(totals.treatment)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Expense Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Feed</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.feed)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seed</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.seed)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Treatment</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totals.treatment)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              {formatCurrency(totals.total)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleSavePondExpenses}
          disabled={isSavingPond}
          style={[styles.primaryButton, isSavingPond && styles.buttonDisabled]}
        >
          <Feather name="check-circle" size={16} color={colors.white} />
          <Text style={styles.primaryButtonText}>
            {isSavingPond ? "Saving..." : "Save Pond Expenses"}
          </Text>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable onPress={() => router.replace("/home" as never)} style={styles.headerIcon}>
              <Feather name="arrow-left" size={20} color={colors.white} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Expense Tracking</Text>
              <Text style={styles.headerSubtitle}>Farm-wide prices & pond costs</Text>
            </View>
            <View style={styles.headerIcon} />
          </View>

          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setActiveTab("prices")}
              style={styles.tabButton}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "prices" && styles.tabTextActive,
                ]}
              >
                Global Prices
              </Text>
              {activeTab === "prices" ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("tracking")}
              style={styles.tabButton}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "tracking" && styles.tabTextActive,
                ]}
              >
                Pond Expenses
              </Text>
              {activeTab === "tracking" ? (
                <View style={styles.tabIndicator} />
              ) : null}
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading expenses...</Text>
            </View>
          ) : activeTab === "prices" ? (
            renderPriceConfig()
          ) : (
            renderTracking()
          )}

          <BottomNav activeTab="expenses" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  screen: { flex: 1 },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: 42,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.softBlue,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  infoBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.warningSoft,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  warningText: {
    flex: 1,
    color: colors.warningText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  required: {
    color: colors.danger,
  },
  inputShell: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  inputDisabled: {
    backgroundColor: "#F8FAFC",
  },
  input: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 8,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  flexField: {
    flex: 1,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  pondChipRow: {
    gap: 8,
    paddingBottom: 4,
  },
  pondChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pondChipActive: {
    backgroundColor: colors.softBlue,
    borderColor: colors.primary,
  },
  pondChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  pondChipTextActive: {
    color: colors.primary,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  modeChipActive: {
    backgroundColor: colors.softBlue,
    borderColor: colors.primary,
  },
  modeChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  modeChipTextActive: {
    color: colors.primary,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  appliedPrice: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  lineAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 2,
  },
  summaryTotalLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  summaryTotalValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
});
