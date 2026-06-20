"use client";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { addDays } from "@/lib/expiry";

interface Item {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  locationId?: string | null;
  photoId?: string | null;
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
  const origName = item.name;
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [locationId, setLocationId] = useState<string | null>(item.locationId ?? null);
  const [storedAt, setStoredAt] = useState(item.storedAt ? item.storedAt.slice(0, 16) : "");
  const [expiresAt, setExpiresAt] = useState(item.expiresAt ? item.expiresAt.slice(0, 10) : "");
  const [photoId, setPhotoId] = useState<string | null>(item.photoId ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestStorage, setSuggestStorage] = useState<string | null>(null);

  // Changing the stored time shifts the expiry by the same span it currently has.
  function changeStoredAt(v: string) {
    if (expiresAt) {
      const od = new Date(storedAt), nd = new Date(v), ex = new Date(`${expiresAt}T00:00:00`);
      if (!Number.isNaN(od.getTime()) && !Number.isNaN(nd.getTime()) && !Number.isNaN(ex.getTime())) {
        const delta = ex.getTime() - od.getTime();
        setExpiresAt(new Date(nd.getTime() + delta).toISOString().slice(0, 10));
      }
    }
    setStoredAt(v);
  }

  // Editing the name re-judges expiry via the text AI; show a suggestion to confirm.
  useEffect(() => {
    const n = name.trim();
    if (!n || n === origName) { setSuggestion(null); setSuggestStorage(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/estimate-expiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
        if (!res.ok) return;
        const { days, storage } = await res.json();
        if (days == null) { setSuggestion(null); setSuggestStorage(null); return; }
        const base = storedAt ? new Date(storedAt) : new Date();
        if (Number.isNaN(base.getTime())) return;
        setSuggestion(addDays(base, days).toISOString().slice(0, 10));
        setSuggestStorage(typeof storage === "string" ? storage : null);
      } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, [name, origName, storedAt]);

  async function swapPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      setPhotoId((await res.json()).photoId);
    } catch {
      setError("照片上傳失敗");
    } finally {
      setUploading(false);
    }
  }

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
          photoId,
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

  function fmt(d: string) { const x = new Date(`${d}T00:00:00`); return `${x.getMonth() + 1}/${x.getDate()}`; }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7f0]" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#3c4650]">編輯食物</h1>
          <button onClick={onClose} className="text-sm text-[#8a8178]">取消</button>
        </div>
        <div className="flex flex-col gap-3">
          {photoId && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/photo/${photoId}`} alt="照片" className="h-40 w-full rounded-xl object-cover" />
          )}
          <label className="cursor-pointer rounded-xl border border-[#5fbe91] py-2.5 text-center text-sm font-medium text-[#3e9e73]">
            {uploading ? "上傳中…" : photoId ? "換照片" : "📷 加照片"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={swapPhoto} />
          </label>

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
            {suggestion && suggestion !== expiresAt && (
              <div className="flex flex-col gap-1">
                <button onClick={() => { setExpiresAt(suggestion); setSuggestion(null); }} className="self-start rounded-lg bg-[#5fbe91]/10 px-3 py-1.5 text-xs font-medium text-[#3e9e73]">
                  🤖 依「{name.trim()}」建議到期日 {fmt(suggestion)}，套用
                </button>
                {suggestStorage && <span className="text-xs text-[#8a8178]">💡 建議保存：{suggestStorage}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（改了到期日會跟著順移）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy || uploading} onClick={save} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
