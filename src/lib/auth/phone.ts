// src/lib/auth/phone.ts
// Normalize a Taiwan phone number to a comparable canonical form: digits only,
// with a leading-0 local format (+886 / 886 international prefix → 0).
export function normalizePhone(input: string): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("886")) digits = "0" + digits.slice(3);
  return digits;
}
