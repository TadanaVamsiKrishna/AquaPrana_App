import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolvePondId } from "../lib/pond-route";
import {
  formatCurrency,
  parsePriceValue,
  sanitizeDecimalInput,
} from "../lib/expense-format";
import { getFarmerPriceConfig, type FarmerPriceConfig } from "../services/farmer-price-config";
import { getPondLogTotals } from "../services/local-daily-logs";
import {
  calculateExpenseTotals,
  type ExpensePriceMode,
  type ManualExpense,
  type PondPriceConfig,
  type TreatmentProduct,
} from "../services/local-pond-expenses";
import { getPondById } from "../services/local-ponds";
import {
  getPondExpenseRecord,
  priceInputValue,
  recalculatePondExpenseRecord,
  resolveCycleId,
  savePondExpenseRecord,
} from "../services/pond-expenses";

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
  chartFeed: "#0A84FF",
  chartSeed: "#22C55E",
  chartTreatment: "#1D4ED8",
  chartOthers: "#CBD5E1",
};

type ExpenseTab = "price" | "tracking";

const UNIT_OPTIONS = ["Litre", "Kg", "Packet", "Bottle", "Unit"];

const createProduct = (): TreatmentProduct => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  unit: "Litre",
  price: 0,
});

function DonutSlice({
  color,
  size,
  thickness,
  startDeg,
  sweepDeg,
}: {
  color: string;
  size: number;
  thickness: number;
  startDeg: number;
  sweepDeg: number;
}) {
  if (sweepDeg <= 0) {
    return null;
  }

  const half = size / 2;
  const clamped = Math.min(sweepDeg, 179.9);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.donutSlice,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${startDeg}deg` }],
        },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: thickness,
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: clamped > 90 ? color : "transparent",
          transform: [{ rotate: `${Math.max(clamped - 90, 0)}deg` }],
        }}
      />
    </View>
  );
}

export default function ExpenseSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pondId: string; tab?: string }>();
  const pondId = resolvePondId(params.pondId);

  const [activeTab, setActiveTab] = useState<ExpenseTab>(
    params.tab === "tracking" ? "tracking" : "price",
  );
  const [cycleDay, setCycleDay] = useState(1);
  const [pondName, setPondName] = useState("Pond");
  const [biomassKg, setBiomassKg] = useState(0);
  const [stockingCount, setStockingCount] = useState(0);
  const [feedKg, setFeedKg] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [priceMode, setPriceMode] = useState<ExpensePriceMode>("fixed");
  const [savedGlobalConfig, setSavedGlobalConfig] =
    useState<FarmerPriceConfig | null>(null);
  const [unitPickerFor, setUnitPickerFor] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const [feedPrice, setFeedPrice] = useState("0.00");
  const [seedPrice, setSeedPrice] = useState("0.00");
  const [labourPrice, setLabourPrice] = useState("0.00");
  const [products, setProducts] = useState<TreatmentProduct[]>([
    createProduct(),
  ]);
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>([]);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const pond = await getPondById(pondId);
      const cycleId = resolveCycleId(pond?.stockingDate);

      const [totals, globalResult, pondExpenseResult] = await Promise.all([
        getPondLogTotals(pondId),
        getFarmerPriceConfig(),
        getPondExpenseRecord(pondId, cycleId),
      ]);

      setPondName(pond?.pondName || pond?.name || "Pond");
      setCycleDay(Math.max(Number(pond?.cycleDay) || 1, 1));
      setFeedKg(totals.cumulativeFeed || 0);

      const biomassMatch = pond?.biomass?.match(/([\d,.]+)/);
      setBiomassKg(biomassMatch ? Number(biomassMatch[1].replace(/,/g, "")) : 0);

      const density = Number(pond?.stockingDensity) || 0;
      const area = Number(pond?.area) || 0;
      setStockingCount(density > 0 ? density * Math.max(area, 1) * 1000 : 0);

      setSavedGlobalConfig(globalResult.config);
      const mode = pondExpenseResult.record?.priceMode === "manual" ? "manual" : "fixed";
      setPriceMode(mode);

      const sourceConfig =
        mode === "manual" && pondExpenseResult.record
          ? {
              feedPricePerKg: pondExpenseResult.record.prices.feedPricePerKg,
              seedPricePerThousand:
                pondExpenseResult.record.prices.seedPricePerThousand,
              labourCostPerDay: pondExpenseResult.record.prices.labourCostPerDay,
              treatmentProducts:
                pondExpenseResult.record.treatmentProducts.length > 0
                  ? pondExpenseResult.record.treatmentProducts
                  : [
                      {
                        id: createProduct().id,
                        name: "Treatment / Mineral",
                        unit: "Unit",
                        price: pondExpenseResult.record.prices.treatmentPricePerUnit,
                      },
                    ],
            }
          : globalResult.config;

      setFeedPrice(priceInputValue(sourceConfig.feedPricePerKg));
      setSeedPrice(priceInputValue(sourceConfig.seedPricePerThousand));
      setLabourPrice(priceInputValue(sourceConfig.labourCostPerDay));
      setProducts(
        sourceConfig.treatmentProducts?.length
          ? sourceConfig.treatmentProducts
          : [createProduct()],
      );

      setManualExpenses(pondExpenseResult.record?.manualExpenses ?? []);

      const errors = [globalResult.error, pondExpenseResult.error].filter(Boolean);
      if (errors.length > 0) {
        setLoadError(errors.join(" "));
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load expense data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const priceConfig: PondPriceConfig = useMemo(
    () => ({
      feedPricePerKg: parsePriceValue(feedPrice),
      seedPricePerThousand: parsePriceValue(seedPrice),
      labourCostPerDay: parsePriceValue(labourPrice),
      treatmentProducts: products.map((product) => ({
        ...product,
        price: parsePriceValue(product.price),
      })),
    }),
    [feedPrice, seedPrice, labourPrice, products],
  );

  const pricesEditable = priceMode === "manual";

  const totals = useMemo(
    () =>
      calculateExpenseTotals({
        feedKg,
        stockingCount,
        cycleDays: cycleDay,
        priceConfig,
        manualExpenses,
      }),
    [feedKg, stockingCount, cycleDay, priceConfig, manualExpenses],
  );

  const projectedCostPerKg =
    biomassKg > 0 ? totals.total / biomassKg : totals.total > 0 ? totals.total : 0;

  const chartSegments = useMemo(() => {
    const values = [
      { label: "Feed", value: totals.feed, color: colors.chartFeed },
      { label: "Seed", value: totals.seed, color: colors.chartSeed },
      { label: "Treatment", value: totals.treatment, color: colors.chartTreatment },
      { label: "Others", value: totals.others + totals.labour, color: colors.chartOthers },
    ];
    const sum = values.reduce((acc, item) => acc + item.value, 0) || 1;
    let cursor = -90;

    return values.map((item) => {
      const percent = Math.round((item.value / sum) * 100);
      const sweep = (item.value / sum) * 360;
      const start = cursor;
      cursor += sweep;
      return { ...item, percent, start, sweep };
    });
  }, [totals]);

  const updateProduct = (
    id: string,
    patch: Partial<TreatmentProduct>,
  ) => {
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

  const openManualModal = (expense?: ManualExpense) => {
    if (expense) {
      setEditingManualId(expense.id);
      setManualTitle(expense.title);
      setManualNote(expense.note);
      setManualAmount(String(expense.amount));
    } else {
      setEditingManualId(null);
      setManualTitle("");
      setManualNote("");
      setManualAmount("");
    }
    setManualModalOpen(true);
  };

  const saveManualExpense = () => {
    if (!manualTitle.trim() || !manualAmount.trim()) {
      Alert.alert("Missing details", "Enter expense title and amount.");
      return;
    }

    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid expense amount.");
      return;
    }

    if (editingManualId) {
      setManualExpenses((current) =>
        current.map((item) =>
          item.id === editingManualId
            ? {
                ...item,
                title: manualTitle.trim(),
                note: manualNote.trim(),
                amount,
              }
            : item,
        ),
      );
    } else {
      setManualExpenses((current) => [
        ...current,
        {
          id: `${Date.now()}`,
          title: manualTitle.trim(),
          note: manualNote.trim() || "Manual expense",
          amount,
        },
      ]);
    }

    setManualModalOpen(false);
  };

  const deleteManualExpense = (id: string) => {
    Alert.alert("Delete expense", "Remove this manual expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          setManualExpenses((current) => current.filter((item) => item.id !== id)),
      },
    ]);
  };

  const applyGlobalPrices = () => {
    if (!savedGlobalConfig) {
      return;
    }

    setFeedPrice(priceInputValue(savedGlobalConfig.feedPricePerKg));
    setSeedPrice(priceInputValue(savedGlobalConfig.seedPricePerThousand));
    setLabourPrice(priceInputValue(savedGlobalConfig.labourCostPerDay));
    setProducts(
      savedGlobalConfig.treatmentProducts?.length
        ? savedGlobalConfig.treatmentProducts
        : [createProduct()],
    );
  };

  const handlePriceModeChange = (mode: ExpensePriceMode) => {
    setPriceMode(mode);
    if (mode === "fixed") {
      applyGlobalPrices();
    }
  };

  const persistExpenses = async (configured: boolean) => {
    if (!pondId) {
      Alert.alert("Pond not found", "Please go back and try again.");
      return false;
    }

    if (configured && priceConfig.feedPricePerKg <= 0) {
      Alert.alert("Feed price required", "Enter Feed Price (₹/kg) before saving.");
      setActiveTab("price");
      return false;
    }

    const pond = await getPondById(pondId);
    const cycleId = resolveCycleId(pond?.stockingDate);
    const globalConfig = savedGlobalConfig ?? {
      feedPricePerKg: 0,
      seedPricePerThousand: 0,
      labourCostPerDay: 0,
      treatmentProducts: [],
    };

    const baseRecord = recalculatePondExpenseRecord({
      record: {
        pondId,
        cycleId,
        priceMode,
        quantities: {
          feedKg,
          seedCount: stockingCount,
          treatmentQty: 0,
        },
        prices: {
          feedPricePerKg: priceConfig.feedPricePerKg,
          seedPricePerThousand: priceConfig.seedPricePerThousand,
          treatmentPricePerUnit:
            priceConfig.treatmentProducts.reduce(
              (sum, product) => sum + parsePriceValue(product.price),
              0,
            ) / Math.max(priceConfig.treatmentProducts.length, 1),
          labourCostPerDay: priceConfig.labourCostPerDay,
        },
        treatmentProducts: priceConfig.treatmentProducts,
        manualExpenses,
        feed: totals.feed,
        seed: totals.seed,
        treatment: totals.treatment,
        labour: totals.labour,
        others: totals.others,
        total: totals.total,
        configured: configured || totals.total > 0,
      },
      globalConfig,
      feedKg,
      stockingCount,
      cycleDays: cycleDay,
    });

    const result = await savePondExpenseRecord(baseRecord);
    if (result.error) {
      Alert.alert("Saved with warning", result.error);
    }

    return true;
  };

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    const saved = await persistExpenses(true);
    setIsSaving(false);

    if (!saved) {
      return;
    }

    Alert.alert("Saved", "Pond expense configuration saved.", [
      {
        text: "View Expenses",
        onPress: () => setActiveTab("tracking"),
      },
      {
        text: "Back to Dashboard",
        onPress: () =>
          router.replace({
            pathname: "/daily-log",
            params: { pondId },
          } as never),
      },
    ]);
  };

  const handleDownloadReport = async () => {
    const saved = await persistExpenses(true);
    if (!saved) {
      return;
    }

    Alert.alert(
      "Expense Report",
      `Total Cycle Cost: ${formatCurrency(totals.total)}\nProjected: ₹${projectedCostPerKg.toFixed(2)} / kg\n\nPDF export will be added soon.`,
    );
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
          Global farmer prices load by default. Switch to manual override only for
          this pond — global prices stay unchanged.
        </Text>
      </View>

      {loadError ? (
        <View style={styles.warningBanner}>
          <Feather name="alert-triangle" size={16} color="#B45309" />
          <Text style={styles.warningText}>{loadError}</Text>
        </View>
      ) : null}

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
              onPress={() => handlePriceModeChange(option.id)}
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
              editable={pricesEditable}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.requiredChip}>REQUIRED</Text>
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Seed / Fry Price (₹/1000 count)</Text>
          <View style={styles.inputShell}>
            <TextInput
              value={seedPrice}
              onChangeText={(value) => setSeedPrice(sanitizeDecimalInput(value))}
              editable={pricesEditable}
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
              editable={pricesEditable}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Treatment & Mineral Prices</Text>
      {products.map((product) => (
        <View key={product.id} style={styles.productCard}>
          <Text style={styles.label}>Product Name</Text>
          <View style={styles.inputShell}>
            <TextInput
              value={product.name}
              onChangeText={(value) => updateProduct(product.id, { name: value })}
              placeholder="e.g. Vitazyme"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.productRow}>
            <View style={styles.productHalf}>
              <Text style={styles.label}>Unit</Text>
              <Pressable
                onPress={() => setUnitPickerFor(product.id)}
                style={styles.selectShell}
              >
                <Text style={styles.selectText}>{product.unit}</Text>
                <Feather name="chevron-down" size={16} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.productHalf}>
              <Text style={styles.label}>Price (₹)</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={priceInputValue(parsePriceValue(product.price))}
                  onChangeText={(value) =>
                    updateProduct(product.id, {
                      price: parsePriceValue(sanitizeDecimalInput(value)),
                    })
                  }
                  editable={pricesEditable}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.input}
                />
              </View>
            </View>

            <Pressable
              onPress={() => removeProduct(product.id)}
              style={styles.deleteIconButton}
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => setProducts((current) => [...current, createProduct()])}
        disabled={!pricesEditable}
        style={[styles.addProductButton, !pricesEditable && styles.buttonDisabled]}
      >
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={styles.addProductText}>+ Add Product</Text>
      </Pressable>
    </ScrollView>
  );

  const renderTracking = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryEyebrow}>TOTAL CYCLE COST</Text>
            <Text style={styles.summaryTotal}>{formatCurrency(totals.total)}</Text>
          </View>
          <View style={styles.onTrackBadge}>
            <Feather name="check" size={12} color={colors.success} />
            <Text style={styles.onTrackText}>On Track</Text>
          </View>
        </View>

        <View style={styles.donutWrap}>
          <View style={styles.donutOuter}>
            {chartSegments.map((segment) => (
              <DonutSlice
                key={segment.label}
                color={segment.color}
                size={140}
                thickness={18}
                startDeg={segment.start}
                sweepDeg={segment.sweep}
              />
            ))}
            <View style={styles.donutHole}>
              <Text style={styles.donutHoleLabel}>Cost</Text>
              <Text style={styles.donutHoleValue}>
                {formatCurrency(totals.total)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.legendRow}>
          {chartSegments.map((segment) => (
            <View key={segment.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
              <Text style={styles.legendText}>
                {segment.label} ({segment.percent}%)
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.projectedRow}>
          <Text style={styles.projectedLabel}>Projected Cost Per Kg</Text>
          <Text style={styles.projectedValue}>
            ₹{projectedCostPerKg.toFixed(2)} / kg
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Auto-calculated Expenses</Text>
      <View style={styles.card}>
        {[
          {
            icon: "coffee" as const,
            title: "Feed Cost",
            note: "Based on daily feed logs",
            amount: totals.feed,
            action: () =>
              router.push({
                pathname: "/pond-logs",
                params: { pondId },
              } as never),
          },
          {
            icon: "droplet" as const,
            title: "Seed (PL) Cost",
            note: "Based on PL stocked",
            amount: totals.seed,
          },
          {
            icon: "package" as const,
            title: "Treatment & Minerals",
            note: "Based on products used",
            amount: totals.treatment,
          },
          {
            icon: "users" as const,
            title: "Labour Cost",
            note: `Based on ${cycleDay} cycle days`,
            amount: totals.labour,
          },
        ].map((item) => (
          <View key={item.title} style={styles.autoRow}>
            <View style={styles.autoIcon}>
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={styles.autoCopy}>
              <Text style={styles.autoTitle}>{item.title}</Text>
              <Text style={styles.autoNote}>{item.note}</Text>
              {item.action ? (
                <Pressable onPress={item.action}>
                  <Text style={styles.autoLink}>View Logs &gt;</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.autoAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.otherHeader}>
        <Text style={styles.sectionTitle}>Other Expenses</Text>
        <Pressable onPress={() => openManualModal()}>
          <Text style={styles.addExpenseLink}>+ Add Expense</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {manualExpenses.length === 0 ? (
          <Text style={styles.emptyManual}>
            No manual expenses yet. Add power, rent, transport, or other costs.
          </Text>
        ) : (
          manualExpenses.map((expense) => (
            <View key={expense.id} style={styles.manualRow}>
              <Pressable
                onPress={() => openManualModal(expense)}
                style={styles.manualMain}
              >
                <View style={styles.autoIcon}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                </View>
                <View style={styles.autoCopy}>
                  <Text style={styles.autoTitle}>{expense.title}</Text>
                  <Text style={styles.autoNote}>{expense.note}</Text>
                </View>
                <Text style={styles.autoAmount}>
                  {formatCurrency(expense.amount)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => deleteManualExpense(expense.id)}
                style={styles.deleteIconButton}
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.headerIcon}>
              <Feather name="arrow-left" size={20} color={colors.white} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {activeTab === "price" ? "Price Configuration" : "Expense Tracking"}
              </Text>
              <View style={styles.dayBadge}>
                <Feather name="calendar" size={12} color={colors.white} />
                <Text style={styles.dayBadgeText}>
                  Till Today (Day {cycleDay}) · {pondName}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Expense settings",
                  "Configure prices and track cycle expenses for this pond.",
                )
              }
              style={styles.headerIcon}
            >
              <Feather
                name={activeTab === "price" ? "bell" : "settings"}
                size={18}
                color={colors.white}
              />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setActiveTab("price")}
              style={styles.tabButton}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "price" && styles.tabTextActive,
                ]}
              >
                Price Config
              </Text>
              {activeTab === "price" ? <View style={styles.tabIndicator} /> : null}
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
                Expense Tracking
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
          ) : activeTab === "price" ? (
            renderPriceConfig()
          ) : (
            renderTracking()
          )}

          <View style={styles.footer}>
            {activeTab === "price" ? (
              <Pressable
                onPress={handleSaveConfiguration}
                disabled={isSaving}
                style={styles.primaryButton}
              >
                <Feather name="save" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => openManualModal()}
                  style={styles.primaryButton}
                >
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.primaryButtonText}>
                    Add New Manual Expense
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDownloadReport}
                  style={styles.outlineButton}
                >
                  <Feather name="download" size={16} color={colors.primary} />
                  <Text style={styles.outlineButtonText}>
                    Download Expense Report (PDF)
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!unitPickerFor}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerFor(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setUnitPickerFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            {UNIT_OPTIONS.map((unit) => (
              <Pressable
                key={unit}
                onPress={() => {
                  if (unitPickerFor) {
                    updateProduct(unitPickerFor, { unit });
                  }
                  setUnitPickerFor(null);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>{unit}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={manualModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setManualModalOpen(false)}
        >
          <Pressable style={styles.manualModalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>
              {editingManualId ? "Edit Expense" : "Add Manual Expense"}
            </Text>

            <Text style={styles.label}>Title</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={manualTitle}
                onChangeText={setManualTitle}
                placeholder="e.g. Power / Electricity"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Note</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={manualNote}
                onChangeText={setManualNote}
                placeholder="e.g. Monthly Bill - Aug"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Amount (₹)</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={manualAmount}
                onChangeText={(value) => setManualAmount(sanitizeDecimalInput(value))}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <Pressable onPress={saveManualExpense} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {editingManualId ? "Update Expense" : "Save Expense"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  keyboardView: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  dayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
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
    paddingTop: 12,
    paddingBottom: 10,
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
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  infoBanner: {
    backgroundColor: colors.softBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  infoBannerText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  warningText: {
    flex: 1,
    color: "#B45309",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
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
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  fieldBlock: { gap: 8 },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  required: { color: colors.danger },
  inputShell: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 10,
  },
  requiredChip: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  productCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  productHalf: {
    flex: 1,
    gap: 8,
  },
  selectShell: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteIconButton: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  addProductButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.softBlue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addProductText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  summaryTotal: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  onTrackBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  onTrackText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "800",
  },
  donutWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  donutOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },
  donutSlice: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  donutHole: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  donutHoleLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  donutHoleValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: "45%",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  projectedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectedLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  projectedValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  autoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  autoCopy: {
    flex: 1,
    gap: 2,
  },
  autoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  autoNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  autoLink: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  autoAmount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  otherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addExpenseLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyManual: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  manualMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: colors.background,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  outlineButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
  },
  manualModalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  modalOption: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
