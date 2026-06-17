"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";

interface Item {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  locationId?: string | null;
}

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base text-[#3c4650] outline-none focus:border-[#5fbe91]";

export function EditFoodSheet({
  item,
  locations,
  onClose,
  onSaved,
}: {
  item: Item;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [locationId, setLocationId] = useState<string | null>(item.locationId ?? null);
  const [storedAt, setStoredAt] = useState(item.storedAt ? item.storedAt.slice(0, 16) : "");
  const [expiresAt, setExpiresAt] = useState(item.expiresAt ? item.expiresAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("請填名稱"); return; }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/food/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          locationId,
          storedAt: storedAt ? new Date(storedAt).toISOString() : item.storedAt,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7f0]"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#3c4650]">編輯食物</h1>
          <button onClick={onClose} className="text-sm text-[#8a8178]">取消</button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">名稱</label>
            <input className={inputCls} placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">類別</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {locations.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8a8178]">存放點</label>
              <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">到期日</label>
            <input className={inputCls} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => setStoredAt(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} onClick={save} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
