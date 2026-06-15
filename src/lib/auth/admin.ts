// src/lib/auth/admin.ts
// The single admin is identified by a hardcoded, already-normalized phone.
// Compare callers must pass a normalizePhone()-ed value.
export const ADMIN_PHONE = "0926571988";

export function isAdminPhone(normalizedPhone: string): boolean {
  return normalizedPhone === ADMIN_PHONE;
}
