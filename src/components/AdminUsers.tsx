// src/components/AdminUsers.tsx
"use client";
import { useEffect, useState } from "react";

interface UserRow { id: string; phone: string | null; name: string; createdAt: string; isAdmin: boolean }

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
      <form onSubmit={add} className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold">新增使用者</h2>
        <div className="flex flex-col gap-2">
          <input type="text" placeholder="名字（例：媽）" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-gray-300 px-3 py-2" required />
          <input type="tel" inputMode="tel" placeholder="電話（例：0912-345-678）" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-gray-300 px-3 py-2" required />
          <button type="submit" disabled={adding} className="rounded bg-[#5FBE91] px-4 py-2 font-semibold text-white disabled:opacity-50">{adding ? "新增中…" : "新增"}</button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border border-gray-200 p-3">
              {editingId === u.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="名字"
                    className="rounded border border-gray-300 px-3 py-2"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={u.isAdmin}
                    placeholder="電話"
                    className="rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  {u.isAdmin && <p className="text-xs text-gray-400">管理員電話固定，無法修改</p>}
                  <div className="flex gap-2">
                    <button onClick={() => save(u)} disabled={saving} className="rounded bg-[#5FBE91] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "儲存中…" : "儲存"}</button>
                    <button onClick={cancelEdit} disabled={saving} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.name}{u.isAdmin && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">管理員</span>}</div>
                    <div className="text-sm text-gray-500">{u.phone}</div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(u)} className="text-sm text-[#5FBE91]">編輯</button>
                    {!u.isAdmin && (
                      <button onClick={() => remove(u.id, u.name)} className="text-sm text-red-700">刪除</button>
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
