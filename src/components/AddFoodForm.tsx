"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState<string>("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("其他");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await (await fetch("/api/photos", { method: "POST", body: fd })).json();
    setPhotoId(res.photoId);
    setStoredAt(res.capturedAt.slice(0, 16)); // default stored = capture time
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    await fetch("/api/food", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            name,
            category,
            photoId,
            storedAt: storedAt ? new Date(storedAt).toISOString() : new Date().toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          },
        ],
      }),
    });
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      <input
        className="rounded border p-2"
        placeholder="名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="rounded border p-2"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {["熟食", "葉菜", "根莖蔬菜", "水果", "肉類", "海鮮", "乳製品", "蛋", "醬料", "飲料", "剩菜", "其他"].map(
          (c) => (
            <option key={c}>{c}</option>
          ),
        )}
      </select>
      <label className="text-sm text-gray-500">放入時間（預設＝拍照時間）</label>
      <input
        className="rounded border p-2"
        type="datetime-local"
        value={storedAt}
        onChange={(e) => setStoredAt(e.target.value)}
      />
      <label className="text-sm text-gray-500">到期日（留空＝依類別自動估算）</label>
      <input
        className="rounded border p-2"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />
      <button
        disabled={busy || !name}
        className="rounded bg-black p-2 text-white disabled:opacity-50"
        onClick={save}
      >
        儲存
      </button>
    </div>
  );
}
