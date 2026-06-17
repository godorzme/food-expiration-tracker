"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

interface UserRow { id: string; phone: string | null; name: string; createdAt: string; isAdmin: boolean; avatarUrl?: string | null }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      setUsers((await res.json()).users ?? []);
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "新增失敗"); return; }
      setPhone(""); setName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`確定刪除「${label}」？刪除後對方將無法登入。`)) return;
    setError("");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "刪除失敗"); return; }
    await load();
  }

  function startEdit(u: UserRow) {
    setError("");
    setEditingId(u.id);
    setEditName(u.name);
    setEditPhone(u.phone ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function save(u: UserRow) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#3c4650]">新增使用者</h2>
        <input type="text" placeholder="名字（例：媽）" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        <input type="tel" inputMode="tel" placeholder="電話（例：0912-345-678）" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} required />
        <button type="submit" disabled={adding} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{adding ? "新增中…" : "新增"}</button>
      </form>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={() => { setLoading(true); load(); }} className="flex-shrink-0 rounded-lg bg-[#5fbe91] px-3 py-1.5 text-sm font-semibold text-white">重新整理</button>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#8a8178]">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-2xl bg-white p-4 shadow-sm">
              {editingId === u.id ? (
                <div className="flex flex-col gap-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="名字" className={inputCls} />
                  <input type="tel" inputMode="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} disabled={u.isAdmin} placeholder="電話" className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`} />
                  {u.isAdmin && <p className="text-xs text-[#8a8178]">管理員電話固定，無法修改</p>}
                  <div className="flex gap-2">
                    <button onClick={() => save(u)} disabled={saving} className="rounded-xl bg-[#5fbe91] px-4 py-2.5 text-sm font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{saving ? "儲存中…" : "儲存"}</button>
                    <button onClick={cancelEdit} disabled={saving} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm text-[#8a8178]">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={u.avatarUrl} name={u.name} size={36} />
                    <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-[#3c4650]">
                      <span className="truncate">{u.name}</span>
                      {u.isAdmin && <span className="flex-shrink-0 rounded-full bg-[#5fbe91]/15 px-2 py-0.5 text-xs text-[#3e9e73]">管理員</span>}
                    </div>
                    <div className="text-sm text-[#8a8178]">{u.phone}</div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button onClick={() => startEdit(u)} className="rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">編輯</button>
                    {!u.isAdmin && (
                      <button onClick={() => remove(u.id, u.name)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">刪除</button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
