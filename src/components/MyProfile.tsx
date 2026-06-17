"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

export function MyProfile({ name, phone, initialAvatar }: { name: string; phone: string | null; initialAvatar: string | null }) {
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/photos", { method: "POST", body: fd });
      if (!up.ok) throw new Error();
      const { photoId } = await up.json();
      const res = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ photoId }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvatar(data.avatarUrl);
    } catch {
      setError("上傳失敗，請重試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <Avatar src={avatar} name={name} size={96} />
      <div className="text-center">
        <div className="text-lg font-bold text-[#3c4650]">{name}</div>
        {phone && <div className="text-sm text-[#8a8178]">{phone}</div>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="w-full cursor-pointer rounded-xl bg-[#5fbe91] py-3 text-center font-semibold text-white active:bg-[#3e9e73]">
        {busy ? "上傳中…" : avatar ? "更換頭像" : "📷 上傳頭像"}
        <input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} disabled={busy} />
      </label>
    </div>
  );
}
