// File names for downloaded reports: "Palace-Sports-Report-January-October-2026.pdf". Pure, so it can be tested.
export function reportFileName(label: string, extension: "pdf" | "xlsx"): string {
  const safe = label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `Palace-Sports-Report-${safe || "report"}.${extension}`;
}

export const MIME_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
