// src/lib/expiryAI.ts
export function parseDays(raw: string): number | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : raw) as { days?: unknown };
    const d = Number(obj.days);
    if (!Number.isFinite(d)) return null;
    const r = Math.round(d);
    if (r < 1) return null;
    return Math.min(r, 3650);
  } catch {
    return null;
  }
}

export interface Estimate {
  days: number | null;
  storage: string | null; // short recommended storage method, e.g. "室溫陰涼乾燥處"
}

// Parse the model reply into days + recommended storage method.
export function parseEstimate(raw: string): Estimate {
  const days = parseDays(raw);
  let storage: string | null = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : raw) as { storage?: unknown };
    if (typeof obj.storage === "string" && obj.storage.trim()) {
      storage = obj.storage.trim().slice(0, 20);
    }
  } catch {
    // leave storage null
  }
  return { days, storage };
}

// Ask the text model to first judge the best home storage method for the item,
// then give the days it keeps under that method. Returns {days:null} when AI Hub
// isn't configured or the call fails (caller falls back to the category table).
export async function estimateDaysFromName(name: string): Promise<Estimate> {
  const base = process.env.AI_HUB_BASE_URL;
  const key = process.env.AI_HUB_API_KEY;
  const model = process.env.AI_HUB_VISION_MODEL;
  if (!base || !key || !model || !name.trim()) return { days: null, storage: null };
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: `你是食物保存期限助手。使用者給一個食物品項名稱,請先判斷這項食物「最適合、最常見的家庭保存方式」(例如冷藏、冷凍、室溫陰涼乾燥處等),再依照該保存方式回答它大約可以放幾天(整數天,常見估計即可)。只回 JSON,格式 {"days": 整數, "storage": "保存方式(20字內)"}。品項：「${name.trim()}」`,
        }],
        temperature: 0,
        max_tokens: 60,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { days: null, storage: null };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = typeof json?.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "";
    return parseEstimate(content);
  } catch {
    return { days: null, storage: null };
  }
}
