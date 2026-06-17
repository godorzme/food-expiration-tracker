// src/components/ui/StatusPill.tsx
// Status colors for food expiry, shared by the whole-card tint and the legend.
import type { ExpiryState } from "@/lib/expiryState";

interface Meta { label: string; edge: string; cardBg: string }

const META: Record<ExpiryState, Meta> = {
  expired: { label: "已過期", edge: "#e5484d", cardBg: "bg-red-50" },
  urgent:  { label: "今明到期", edge: "#f5821f", cardBg: "bg-orange-50" },
  soon:    { label: "接近到期", edge: "#eab308", cardBg: "bg-[#fffbe6]" },
  ok:      { label: "安全", edge: "#5fbe91", cardBg: "bg-green-50" },
  none:    { label: "無到期日", edge: "#b8b2a8", cardBg: "bg-white" },
};

export function statusMeta(state: ExpiryState): Meta {
  return META[state];
}
