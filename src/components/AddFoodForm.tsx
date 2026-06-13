"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";

interface Row { id: string; name: string; category: string; expiresAt: string; fromAI: boolean }

const blankRow = (): Row => ({ id: crypto.randomUUID(), name: "", category: "其他", expiresAt: "", fromAI: false });

interface PhotoResponse {
  photoId: string;
  capturedAt: string;
  recognized?: Array<{ name: string; category: string; confidence: number }>;
}

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

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
        ? recognized.map((r) => ({ id: crypto.randomUUID(), name: r.name, category: r.category, expiresAt: "", fromAI: true }))
        : [blankRow()]);
    } catch {
      // upload/recognition failed — still allow manual entry with one blank row
      setRows([blankRow()]);
    } finally {
      setBusy(false); setRecognizing(false);
    }
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function addRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId, storedAt: stored,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: r.fromAI,
        })) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      router.push("/");
    } catch {
      setBusy(false); // let the user retry
    }
  }

  const canSave = !busy && rows.some((r) => r.name.trim());

  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      {recognizing && <p className="text-sm text-gray-500">辨識中…</p>}
      {rows.length > 0 && (
        <>
          <label className="text-sm text-gray-500">放入時間（預設＝拍照時間）</label>
          <input className="rounded border p-2" type="datetime-local" value={storedAt} onChange={(e) => setStoredAt(e.target.value)} />
          {rows.map((r) => (
            <div key={r.id} className="rounded border p-3 flex flex-col gap-2">
              <input className="rounded border p-2" placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className="rounded border p-2" value={r.category} onChange={(e) => update(r.id, { category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-gray-500">到期日（留空＝依類別自動估）</label>
              <input className="rounded border p-2" type="date" value={r.expiresAt}
                onChange={(e) => update(r.id, { expiresAt: e.target.value })} />
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(r.id)}>刪除這筆</button>
            </div>
          ))}
          <button className="rounded border p-2" onClick={addRow}>＋ 再加一筆</button>
          <button disabled={!canSave} className="rounded bg-black p-2 text-white disabled:opacity-50" onClick={save}>儲存</button>
        </>
      )}
    </div>
  );
}
