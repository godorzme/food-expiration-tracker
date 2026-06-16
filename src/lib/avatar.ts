// src/lib/avatar.ts
export function initials(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0];
}
