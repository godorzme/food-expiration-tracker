import { estimateExpiry } from "./expiry";

export interface ResolveExpiryInput {
  category: string;
  storedAt: Date;
  manualExpiresAt: Date | null;
}

export function resolveExpiresAt(input: ResolveExpiryInput, shelfLife: Record<string, number>): Date | null {
  if (input.manualExpiresAt) return input.manualExpiresAt;
  return estimateExpiry(input.category, input.storedAt, shelfLife);
}
