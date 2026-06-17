"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { defaultLocationId } from "@/lib/locations";

interface Row { id: string; name: string; category: string; expiresAt: string; fromAI: boolean; expiryEdited: boolean }

const blankRow = (): Row => ({ id: crypto.randomUUID(), name: "", category: "其他", expiresAt: "", fromAI: false, expiryEdited: false });

interface RecognizedItem { name: string; category: string; confidence: number; expiresAt?: string | null }
interface PhotoResponse { photoId: string; capturedAt: string; recognized?: RecognizedItem[] }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [shelfLife, setShelfLife] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((d) => {
        const locs = d.locations ?? [];
        setLocations(locs);
        setLocationId((cur) => cur ?? defaultLocationId(locs));
      })
      .catch(() => {});
    fetch("/api/shelf-life")
      .then((r) => (r.ok ? r.json() : { shelfLife: {} }))
      .then((d) => setShelfLife(d.shelfLife ?? {}))
      .catch(() => {});
  }, []);

  // Estimate an expiry date (YYYY-MM-DD) from category shelf-life + stored time.
  function estimate(category: string, storedAtStr: string): string {
    const days = shelfLife[category];
    const base = storedAtStr ? new Date(storedAtStr) : new Date();
    if (days == null || Number.isNaN(base.getTime())) return "";
    return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setRecognizing(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: PhotoResponse = await res.json();
      setPhotoId(data.photoId);
      setStoredAt(data.capturedAt.slice(0, 16));
      const recognized = data.recognized ?? [];
      setRows(recognized.length
        ? recognized.map((r) => ({ id: crypto.randomUUID(), name: r.name, category: r.category, expiresAt: r.expiresAt ? r.expiresAt.slice(0, 10) : "", fromAI: true, expiryEdited: false }))
        : [blankRow()]);
    } catch {
      setRows([blankRow()]);
    } finally {
      setBusy(false); setRecognizing(false);
    }
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function changeCategory(id: string, category: string) {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, category, expiresAt: r.expiryEdited ? r.expiresAt : estimate(category, storedAt) } : r));
  }
  function changeStoredAt(v: string) {
    setStoredAt(v);
    setRows((rs) => rs.map((r) => r.expiryEdited ? r : { ...r, expiresAt: estimate(r.category, v) }));
  }
  function addRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId, locationId, storedAt: stored,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: r.fromAI,
        })) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      router.push("/");
    } catch {
      setBusy(false);
    }
  }

  const canSave = !busy && !!locationId && rows.some((r) => r.name.trim());

  return (
    <div className="flex flex-col gap-4">
      {photoId ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photo/${photoId}`} alt="食物照片" className="max-h-64 w-full object-cover" />
          <label className="block cursor-pointer py-3 text-center text-sm font-medium text-[#3e9e73]">
            重拍 / 換照片
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
          </label>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5fbe91]/50 bg-white py-8 text-center">
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-[#3e9e73]">拍照或選相簿</span>
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </label>
      )}

      {recognizing && (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-[#8a8178] shadow-sm">辨識中…</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">存放點</label>
            <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（預設＝拍照時間）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <input className={inputCls} placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className={inputCls} value={r.category} onChange={(e) => changeCategory(r.id, e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-[#8a8178]">到期日（AI 估算，可改）</label>
              <input className={inputCls} type="date" value={r.expiresAt} onChange={(e) => update(r.id, { expiresAt: e.target.value, expiryEdited: true })} />
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(r.id)}>刪除這筆</button>
            </div>
          ))}

          <button className="rounded-xl border border-[#5fbe91] py-3 text-sm font-medium text-[#3e9e73]" onClick={addRow}>＋ 再加一筆</button>
          <button disabled={!canSave} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50" onClick={save}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </>
      )}
    </div>
  );
}
