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

// Ask the text model how many days an item keeps in a typical home fridge.
// Returns null when AI Hub isn't configured or the call fails (caller falls back).
export async function estimateDaysFromName(name: string): Promise<number | null> {
  const base = process.env.AI_HUB_BASE_URL;
  const key = process.env.AI_HUB_API_KEY;
  const model = process.env.AI_HUB_VISION_MODEL;
  if (!base || !key || !model || !name.trim()) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: `你是食物保存期限助手。使用者給一個食物品項名稱,回答它在一般家庭冰箱冷藏下大約可以放幾天(整數天,常見估計即可)。只回 JSON,格式 {"days": 整數}。品項：「${name.trim()}」`,
        }],
        temperature: 0,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = typeof json?.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "";
    return parseDays(content);
  } catch {
    return null;
  }
}
