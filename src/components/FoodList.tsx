"use client";
import { useEffect, useState } from "react";
import { expiryState } from "@/lib/expiryState";
import { statusMeta } from "@/components/ui/StatusPill";
import { StatusLegend } from "@/components/ui/StatusLegend";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LocationChips } from "@/components/ui/LocationChips";
import { Avatar } from "@/components/ui/Avatar";
import { EditFoodSheet } from "@/components/EditFoodSheet";

interface FoodItemDTO {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  photoUrl?: string | null;
  createdByName?: string | null;
  createdByAvatar?: string | null;
  locationId?: string | null;
  locationName?: string | null;
}

export function FoodList({ leadDays }: { leadDays: number }) {
  const [items, setItems] = useState<FoodItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const now = useState(() => new Date())[0];
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"expiry" | "stored" | "name">("expiry");
  const [creator, setCreator] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodItemDTO | null>(null);

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
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/locations").then((r) => r.ok ? r.json() : { locations: [] }).then((d) => setLocations(d.locations ?? [])).catch(() => {});
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

  if (loading) return <p className="py-8 text-center text-sm text-[#8a8178]">載入中…</p>;
  if (error)
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="mb-3 text-sm text-red-600">載入失敗</p>
        <button onClick={() => load()} className="rounded-xl bg-[#5fbe91] px-4 py-2 text-sm font-semibold text-white">重新整理</button>
      </div>
    );
  if (items.length === 0)
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mb-2 text-4xl">🍱</div>
        <p className="text-sm text-[#8a8178]">還沒有食物，點下方「＋ 新增食物」記錄第一樣吧。</p>
      </div>
    );

  const creators = Array.from(new Set(items.map((i) => i.createdByName).filter(Boolean))) as string[];
  const q = query.trim().toLowerCase();
  const shown = items
    .filter((it) => (selectedLoc ? it.locationId === selectedLoc : true))
    .filter((it) => (creator ? it.createdByName === creator : true))
    .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "zh-Hant");
      if (sortBy === "stored") return new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime();
      const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
      const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
      return ax - bx;
    });

  const ctrlCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#3c4650] outline-none focus:border-[#5fbe91]";

  return (
    <>
      <div className="relative mb-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8178]">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋食物名稱"
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-[#3c4650] outline-none focus:border-[#5fbe91]"
        />
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "expiry" | "stored" | "name")} className={ctrlCls}>
          <option value="expiry">排序：到期日</option>
          <option value="stored">排序：最新加入</option>
          <option value="name">排序：名稱</option>
        </select>
        <select value={creator ?? ""} onChange={(e) => setCreator(e.target.value || null)} className={ctrlCls}>
          <option value="">誰加的：全部</option>
          {creators.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="mb-3">
        <StatusLegend />
      </div>
      {locations.length > 1 && (
        <div className="mb-3">
          <LocationChips locations={locations} selected={selectedLoc} onSelect={setSelectedLoc} />
        </div>
      )}
      {shown.length === 0 && (
        <p className="py-8 text-center text-sm text-[#8a8178]">找不到符合的食物。</p>
      )}
      <ul className="flex flex-col gap-3">
        {shown.map((it) => {
          const exp = it.expiresAt ? new Date(it.expiresAt) : null;
          const state = expiryState(exp, now, leadDays);
          const m = statusMeta(state);
          return (
            <li
              key={it.id}
              className={`flex items-center gap-3 overflow-hidden rounded-2xl ${m.cardBg} p-3 shadow-sm`}
              style={{ borderLeft: `4px solid ${m.edge}` }}
            >
              {it.photoUrl ? (
                <img
                  src={it.photoUrl}
                  alt={it.name}
                  loading="lazy"
                  onClick={() => setLightbox({ src: it.photoUrl as string, alt: it.name })}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="h-16 w-16 flex-shrink-0 cursor-pointer rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-black/5 text-2xl">🍽️</div>
              )}
              <div className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1" onClick={() => setEditing(it)}>
                {/* Line 1: name + expiry (right) */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold text-[#3c4650]">{it.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-[#3c4650]">
                    {exp ? `到期 ${exp.getMonth() + 1}/${exp.getDate()}` : "無到期日"}
                    <span className="text-[#8a8178]">✏️</span>
                  </span>
                </div>
                {/* Line 2: category · location */}
                <div className="truncate text-xs text-[#8a8178]">
                  {it.category}{it.locationName ? ` · ${it.locationName}` : ""}
                </div>
                {/* Line 3: creator (left) + actions (right) */}
                <div className="flex items-center justify-between gap-2">
                  {it.createdByName ? (
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-[#8a8178]">
                      <Avatar src={it.createdByAvatar} name={it.createdByName} size={18} />
                      <span className="truncate">{it.createdByName} 加的</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <div className="flex flex-shrink-0 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); mark(it.id, "consumed"); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm">✓ 吃掉</button>
                    <button onClick={(e) => { e.stopPropagation(); mark(it.id, "discarded"); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm">🗑 丟掉</button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {lightbox && <PhotoLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      {editing && (
        <EditFoodSheet
          item={editing}
          locations={locations}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
