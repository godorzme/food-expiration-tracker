// src/lib/storageMethod.ts
// The three fixed storage methods the user can pick when recording food.
export const STORAGE_METHODS = ["冷藏", "冷凍", "常溫"] as const;
export type StorageMethod = (typeof STORAGE_METHODS)[number];

// Map free text or model output (e.g. "室溫陰涼乾燥處", "冷藏保存4°C") to one of
// the three fixed methods. Returns null when nothing matches.
export function normalizeStorage(raw: string | null | undefined): StorageMethod | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.includes("冷凍") || /freez/i.test(s)) return "冷凍";
  if (s.includes("冷藏") || s.includes("冰箱") || /fridge|refriger/i.test(s)) return "冷藏";
  if (s.includes("常溫") || s.includes("室溫") || s.includes("陰涼") || s.includes("乾燥") || /room|pantry|cool|dry/i.test(s))
    return "常溫";
  if ((STORAGE_METHODS as readonly string[]).includes(s)) return s as StorageMethod;
  return null;
}
