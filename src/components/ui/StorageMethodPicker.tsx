"use client";
import { STORAGE_METHODS } from "@/lib/storageMethod";

export function StorageMethodPicker({
  value,
  onChange,
  busy,
}: {
  value: string | null;
  onChange: (m: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STORAGE_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          disabled={busy}
          onClick={() => onChange(m)}
          className={`rounded-xl border py-2.5 text-sm font-medium disabled:opacity-50 ${
            value === m
              ? "border-[#5fbe91] bg-[#5fbe91]/10 text-[#3e9e73]"
              : "border-black/10 bg-white text-[#3c4650]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
