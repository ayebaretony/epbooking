// DISPLAY-ONLY helpers for the Call and WhatsApp buttons. They never change what is stored in a booking's `contact`.
// Contacts on existing bookings come in mixed layouts: local 05xxxxxxxx, +971 50 123 4567, 971501234567 and a few others.

// A number in international form ("+971501234567"), or null when it cannot be read as a phone number.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[a-z@]/i.test(trimmed)) return null; // empty, or an email / free text
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 00971... is the same as +971...
  else if (!hadPlus && digits.startsWith("0")) return digits.length === 10 || digits.length === 9 ? `+971${digits.slice(1)}` : null; // 050 123 4567

  if (digits.startsWith("971")) {
    const national = digits.slice(3).replace(/^0/, ""); // +971 (0)50... sometimes keeps the 0
    return national.length >= 8 && national.length <= 9 ? `+971${national}` : null;
  }
  if (!hadPlus && digits.length === 9 && digits.startsWith("5")) return `+971${digits}`; // 501234567
  if (hadPlus && digits.length >= 8 && digits.length <= 15) return `+${digits}`; // another country's number
  return null;
}

export function telHref(raw: string): string | null {
  const phone = normalizePhone(raw);
  return phone ? `tel:${phone}` : null;
}

export function whatsappHref(raw: string): string | null {
  const phone = normalizePhone(raw);
  return phone ? `https://wa.me/${phone.slice(1)}` : null;
}
