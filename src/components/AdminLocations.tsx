"use client";
import { useEffect, useState } from "react";

interface LocRow { id: string; name: string; photoUrl: string | null; itemCount: number }
const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AdminLocations() {
  const [locs, setLocs] = useState<LocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error();
      setLocs((await res.json()).locations ?? []);
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>): Promise<string | null> {
    const file = e.target.files?.[0];
    if (!file) return null;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      return (await res.json()).photoId as string;
    } catch {
      setError("照片上傳失敗");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "新增失敗"); return; }
      setName(""); setPhotoId(null);
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string, newPhotoId?: string | null) {
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editingId === id) payload.name = editName;
      if (newPhotoId !== undefined) payload.photoId = newPhotoId;
      const res = await fetch(`/api/admin/locations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`確定刪除存放點「${label}」？`)) return;
    setError("");
    const res = await fetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "刪除失敗"); return; }
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#3c4650]">新增存放點</h2>
        <input type="text" placeholder="名稱（例：冷凍庫）" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#5fbe91]/50 py-4 text-sm font-medium text-[#3e9e73]">
          {uploading ? "上傳中…" : photoId ? "✓ 已附位置照（可重選）" : "📷 拍位置照（可選）"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const id = await uploadPhoto(e); if (id) setPhotoId(id); }} />
        </label>
        <button type="submit" disabled={adding || uploading} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{adding ? "新增中…" : "新增存放點"}</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#8a8178]">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {locs.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              {l.photoUrl ? (
                <img src={l.photoUrl} alt={l.name} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#f1ece3] text-xl">📍</div>
              )}
              <div className="min-w-0 flex-1">
                {editingId === l.id ? (
                  <div className="flex flex-col gap-2">
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(l.id)} disabled={saving} className="rounded-lg bg-[#5fbe91] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">儲存</button>
                      <button onClick={() => setEditingId(null)} disabled={saving} className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#8a8178]">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#3c4650]">{l.name}</div>
                      <div className="text-xs text-[#8a8178]">{l.itemCount} 樣食物</div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <label className="cursor-pointer rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">
                        換照
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const id = await uploadPhoto(e); if (id) await saveEdit(l.id, id); }} />
                      </label>
                      <button onClick={() => { setEditingId(l.id); setEditName(l.name); }} className="rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">改名</button>
                      <button onClick={() => remove(l.id, l.name)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">刪除</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
