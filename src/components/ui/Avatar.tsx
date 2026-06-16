// src/components/ui/Avatar.tsx
"use client";
import { useState } from "react";
import { initials } from "@/lib/avatar";

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const dim = { width: size, height: size };
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        style={dim}
        onError={() => setErr(true)}
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: Math.round(size * 0.45) }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#5fbe91]/20 font-semibold text-[#3e9e73]"
    >
      {initials(name)}
    </span>
  );
}
