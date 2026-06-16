"use client";

interface Loc { id: string; name: string }

export function LocationChips({
  locations, selected, onSelect, allowAll = true,
}: { locations: Loc[]; selected: string | null; onSelect: (id: string | null) => void; allowAll?: boolean }) {
  const base = "flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border";
  const on = "bg-[#5fbe91] text-white border-[#5fbe91]";
  const off = "bg-white text-[#8a8178] border-black/10";
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {allowAll && (
        <button type="button" onClick={() => onSelect(null)} className={`${base} ${selected === null ? on : off}`}>全部</button>
      )}
      {locations.map((l) => (
        <button key={l.id} type="button" onClick={() => onSelect(l.id)} className={`${base} ${selected === l.id ? on : off}`}>{l.name}</button>
      ))}
    </div>
  );
}
