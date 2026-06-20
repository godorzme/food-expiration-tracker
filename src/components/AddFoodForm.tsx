"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { StorageMethodPicker } from "@/components/ui/StorageMethodPicker";
import { defaultLocationId } from "@/lib/locations";
import { addDays } from "@/lib/expiry";

interface Row {
  id: string;
  photoId: string | null;
  photoUrl: string | null;
  name: string;
  category: string;
  days: number | null;
  storage: string | null;
  expiresAt: string;
  expiryEdited: boolean;
  fromAI: boolean;
}

const blankRow = (): Row => ({ id: crypto.randomUUID(), photoId: null, photoUrl: null, name: "", category: "其他", days: null, storage: "冷藏", expiresAt: "", expiryEdited: false, fromAI: false });

interface PhotoResponse { photoId: string; capturedAt: string; item: { name: string; category: string; days: number | null; storage: string | null } | null }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base text-[#3c4650] outline-none focus:border-[#5fbe91]";

export function AddFoodForm() {
  const router = useRouter();
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [recalc, setRecalc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((d) => {
        const locs = d.locations ?? [];
        setLocations(locs);
        setLocationId((cur) => cur ?? defaultLocationId(locs));
      })
      .catch(() => {});
  }, []);

  function expiryFor(days: number | null, storedAtStr: string): string {
    if (days == null) return "";
    const base = storedAtStr ? new Date(storedAtStr) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    return addDays(base, days).toISOString().slice(0, 10);
  }

  // Each selected photo → one item (its own photo). Uploaded sequentially.
  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setBusy(true);
    let stored = storedAt;
    const added: Row[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`辨識中 ${i + 1}/${files.length}…`);
      try {
        const fd = new FormData(); fd.append("file", files[i]);
        const res = await fetch("/api/photos", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const data: PhotoResponse = await res.json();
        if (i === 0 && !stored) stored = data.capturedAt.slice(0, 16);
        const it = data.item;
        added.push({
          id: crypto.randomUUID(),
          photoId: data.photoId,
          photoUrl: `/api/photo/${data.photoId}`,
          name: it?.name ?? "",
          category: it?.category ?? "其他",
          days: it?.days ?? null,
          storage: it?.storage ?? "冷藏",
          expiresAt: expiryFor(it?.days ?? null, stored),
          expiryEdited: false,
          fromAI: !!it,
        });
      } catch {
        // skip a failed photo; user can still 手動加一筆
      }
    }
    if (!storedAt && stored) setStoredAt(stored);
    setRows((rs) => [...rs, ...added]);
    setProgress(null);
    setBusy(false);
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function changeCategory(id: string, category: string) { update(id, { category }); }
  function changeStoredAt(v: string) {
    setStoredAt(v);
    setRows((rs) => rs.map((r) => r.expiryEdited ? r : { ...r, expiresAt: expiryFor(r.days, v) }));
  }
  function addManualRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  // Switching storage method re-asks the AI for the days under that method and
  // recomputes the expiry (unless the user has manually edited the expiry).
  async function changeStorage(id: string, method: string) {
    const row = rows.find((r) => r.id === id);
    update(id, { storage: method });
    if (!row?.name.trim()) return;
    setRecalc((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetch("/api/estimate-expiry", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: row.name.trim(), method }),
      });
      if (res.ok) {
        const { days } = await res.json();
        if (days != null) update(id, { days, expiresAt: expiryFor(days, storedAt), expiryEdited: false });
      }
    } catch {
      // keep current expiry on failure
    } finally {
      setRecalc((m) => ({ ...m, [id]: false }));
    }
  }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, storage: r.storage, photoId: r.photoId, locationId, storedAt: stored,
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
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5fbe91]/50 bg-white py-8 text-center">
        <span className="text-3xl">📷</span>
        <span className="text-sm font-medium text-[#3e9e73]">拍照或選相簿（可多張）</span>
        <span className="text-xs text-[#8a8178]">📸 一張照片 = 一項物品</span>
        <input type="file" accept="image/*" capture="environment" multiple onChange={onPhotos} className="hidden" />
      </label>

      {progress && (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-[#8a8178] shadow-sm">{progress}</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">存放點</label>
            <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（這批共用）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              {r.photoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.photoUrl} alt={r.name || "照片"} className="h-32 w-full rounded-xl object-cover" />
              )}
              <input className={inputCls} placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className={inputCls} value={r.category} onChange={(e) => changeCategory(r.id, e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-[#8a8178]">保存方式（AI 建議，可改；改了會重算到期日）</label>
              <StorageMethodPicker value={r.storage} onChange={(m) => changeStorage(r.id, m)} busy={recalc[r.id]} />
              <label className="text-xs text-[#8a8178]">到期日（AI 估算，可改）</label>
              <input className={inputCls} type="date" value={r.expiresAt} onChange={(e) => update(r.id, { expiresAt: e.target.value, expiryEdited: true })} />
              {recalc[r.id] && <p className="text-xs text-[#8a8178]">依保存方式重算到期日中…</p>}
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(r.id)}>刪除這筆</button>
            </div>
          ))}

          <button className="rounded-xl border border-[#5fbe91] py-3 text-sm font-medium text-[#3e9e73]" onClick={addManualRow}>＋ 手動加一筆</button>
          <button disabled={!canSave} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50" onClick={save}>
            {busy ? "處理中…" : "儲存"}
          </button>
        </>
      )}
    </div>
  );
}
