"use client";
import { useEffect, useState } from "react";
import { expiryState } from "@/lib/expiryState";
import { StatusPill, statusMeta } from "@/components/ui/StatusPill";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LocationChips } from "@/components/ui/LocationChips";

interface FoodItemDTO {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  photoUrl?: string | null;
  createdByName?: string | null;
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

  const shown = selectedLoc ? items.filter((it) => it.locationId === selectedLoc) : items;

  return (
    <>
      {locations.length > 1 && (
        <div className="mb-3">
          <LocationChips locations={locations} selected={selectedLoc} onSelect={setSelectedLoc} />
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {shown.map((it) => {
          const exp = it.expiresAt ? new Date(it.expiresAt) : null;
          const state = expiryState(exp, now, leadDays);
          const edge = statusMeta(state).edge;
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-sm"
              style={{ borderLeft: `4px solid ${edge}` }}
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
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#f1ece3] text-2xl">🍽️</div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#2d2a26]">{it.name}</span>
                  <StatusPill state={state} />
                </div>
                <div className="truncate text-xs text-[#8a8178]">
                  {it.category}
                  {it.locationName ? ` · ${it.locationName}` : ""}
                  {it.createdByName ? ` · ${it.createdByName} 加的` : ""}
                  {exp ? ` · 到期 ${exp.toLocaleDateString("zh-TW")}` : ""}
                </div>
                <div className="mt-1 flex gap-2">
                  <button onClick={() => mark(it.id, "consumed")} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">✓ 吃掉</button>
                  <button onClick={() => mark(it.id, "discarded")} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">🗑 丟掉</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {lightbox && <PhotoLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
