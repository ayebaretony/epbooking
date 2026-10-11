// All money is stored as integer fils (100 fils = 1 AED) and shown through these helpers (AGENTS.md section 5).
// Components never write "AED" themselves; the currency comes from DEFAULT_CENTER_SETTINGS.

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, showDecimals: boolean) {
  const key = `${currency}:${showDecimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

// "AED 540" for whole amounts, "AED 527.10" when there are fils, so figures stay short and still exact.
export function formatMoney(minor: number, currency: string): string {
  return getFormatter(currency, minor % 100 !== 0).format(minor / 100);
}

// "AED 750/hr"
export function formatRate(hourlyRateMinor: number, currency: string): string {
  return `${formatMoney(hourlyRateMinor, currency)}/hr`;
}

// What a person types into a price field ("750", "527.1", "1,200.50") -> fils. null when it isn't a valid amount.
// Two decimals at most, so nothing is silently rounded away.
export function parseMajorToMinor(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

// Fils -> text for a price field: 75000 -> "750", 52710 -> "527.10"
export function minorToMajorInput(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

// Partial hours are charged proportionally, rounded once to whole fils. Only for NEW bookings:
// totals of existing ones are snapshots and are never recomputed.
export function calcTotalMinor(hourlyRateMinor: number, durationMinutes: number): number {
  return Math.round((hourlyRateMinor * durationMinutes) / 60);
}

// Bookings in Firestore store AED as a number (e.g. 527.1), and that format never changes. Calculations inside the
// app use whole fils, and these two convert at the edge: read with aedToFils, write with filsToAed.
export function aedToFils(aed: number): number {
  return Math.round(aed * 100);
}

export function filsToAed(fils: number): number {
  return fils / 100;
}

// Stored amounts are AED numbers (e.g. 790.65), so screens format them through here: "AED 790.65", "AED 1,500"
export function formatAed(aed: number, currency: string): string {
  return formatMoney(aedToFils(aed), currency);
}

// Change from `previous` to `current` as a ratio (0.12 = +12%). null when there is nothing to compare with.
export function changeRatio(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

const percentFormatter = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

// 0.124 -> "+12.4%", -0.03 -> "-3%", 0 -> "0%"
export function formatPercentChange(ratio: number): string {
  return percentFormatter.format(ratio);
}
