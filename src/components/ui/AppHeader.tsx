// src/components/ui/AppHeader.tsx
import type { ReactNode } from "react";

export function AppHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-10 -mx-4 mb-3 border-b border-black/5 bg-[#fbf7f0]/90 px-4 py-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#2d2a26]">{title}</h1>
          {subtitle && <p className="text-xs text-[#8a8178]">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 text-sm">{actions}</div>}
      </div>
    </header>
  );
}
