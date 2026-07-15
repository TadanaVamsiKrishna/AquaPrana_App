export const NOT_RECORDED = "Not Recorded";

/** Standard PDF fonts only support WinAnsi (Latin-1). */
export const sanitizePdfText = (text: string): string =>
  text
    .replace(/\u20B9/g, "Rs. ")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, "");

export const displayValue = (value: unknown): string => {  if (value === null || value === undefined || value === "") {
    return NOT_RECORDED;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return NOT_RECORDED;
  }

  return String(value);
};

export const displayNumber = (
  value: number | null | undefined,
  decimals = 2,
): string => {
  if (value == null || !Number.isFinite(value)) {
    return NOT_RECORDED;
  }

  return value.toFixed(decimals);
};

export const displayCurrency = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return NOT_RECORDED;
  }

  return `Rs. ${value.toLocaleString("en-IN", {    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return NOT_RECORDED;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return NOT_RECORDED;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
