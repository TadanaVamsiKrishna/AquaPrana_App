/** Parse a currency / unit price string without unit conversion. */
export const parsePriceValue = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sanitizeDecimalInput = (value: string) => {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const parts = cleanedValue.split(".");
  if (parts.length <= 1) {
    return cleanedValue;
  }
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

/** Display stored ₹/kg (or any unit price) as entered — never divide by 1000. */
export const formatUnitPrice = (value: number, decimals = 2) => {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }

  const rounded = Number(value.toFixed(decimals));
  return rounded.toString();
};

export const formatPriceLabel = (value: number, unit: string) =>
  `₹${formatUnitPrice(value)}${unit ? ` / ${unit}` : ""}`;

export const formatCurrency = (value: number) =>
  `₹${Math.round(value).toLocaleString("en-IN")}`;
