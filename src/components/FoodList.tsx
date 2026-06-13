"use client";
import { useEffect, useState } from "react";
import { expiryState, type ExpiryState } from "@/lib/expiryState";

const COLOR: Record<ExpiryState, string> = {
  expired: "border-red-500 bg-red-50",
  urgent: "border-orange-500 bg-orange-50",
  soon: "border-yellow-500 bg-yellow-50",
  ok: "border-green-500 bg-green-50",
  none: "border-gray-300 bg-gray-50",
};

interface FoodItemDTO {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
}

export function FoodList({ leadDays }: { leadDays: number }) {
  const [items, setItems] = useState<FoodItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const now = useState(() => new Date())[0];

  async function load() {
    setError(false);
    try {
      const res = await fetch("/api/food");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: { items?: FoodItemDTO[] } = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function mark(id: string, status: string) {
    try {
      const res = await fetch(`/api/food/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch {
      setError(true);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">載入中…</p>;
  if (error)
    return (
      <div className="text-sm text-red-600">
        載入失敗。<button className="underline" onClick={() => load()}>重試</button>
      </div>
    );
  if (items.length === 0) return <p className="text-sm text-gray-500">冰箱是空的,點「＋ 新增」記錄第一樣食物。</p>;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        const exp = it.expiresAt ? new Date(it.expiresAt) : null;
        const state = expiryState(exp, now, leadDays);
        return (
          <li key={it.id} className={`rounded-lg border-l-4 p-3 ${COLOR[state]}`}>
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{it.name}</div>
                <div className="text-sm text-gray-500">
                  {it.category} · 放入 {new Date(it.storedAt).toLocaleDateString()}
                  {exp ? ` · 到期 ${exp.toLocaleDateString()}` : " · 無到期日"}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-sm text-green-700" onClick={() => mark(it.id, "consumed")}>吃掉</button>
                <button className="text-sm text-red-700" onClick={() => mark(it.id, "discarded")}>丟掉</button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
