// src/components/ui/StatusPill.tsx
import type { ExpiryState } from "@/lib/expiryState";

interface Meta { label: string; emoji: string; pill: string; edge: string }

const META: Record<ExpiryState, Meta> = {
  expired: { label: "已過期", emoji: "🔴", pill: "bg-red-50 text-red-700", edge: "#e5484d" },
  urgent:  { label: "今明到期", emoji: "🟠", pill: "bg-orange-50 text-orange-700", edge: "#f5821f" },
  soon:    { label: "接近到期", emoji: "🟡", pill: "bg-[#fff3b0] text-[#7a6512]", edge: "#ffe450" },
  ok:      { label: "安全", emoji: "🟢", pill: "bg-green-50 text-green-700", edge: "#5fbe91" },
  none:    { label: "無到期日", emoji: "⚪", pill: "bg-gray-100 text-gray-500", edge: "#b8b2a8" },
};

export function statusMeta(state: ExpiryState): Meta {
  return META[state];
}

export function StatusPill({ state }: { state: ExpiryState }) {
  const m = META[state];
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.pill}`}>
      {m.emoji} {m.label}
    </span>
  );
}
