// src/components/ui/StatusLegend.tsx
import type { ExpiryState } from "@/lib/expiryState";
import { statusMeta } from "./StatusPill";

const STATES: ExpiryState[] = ["expired", "urgent", "soon", "ok"];

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a8178]">
      <span>顏色說明</span>
      {STATES.map((s) => {
        const m = statusMeta(s);
        return (
          <span key={s} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.edge }} />
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
