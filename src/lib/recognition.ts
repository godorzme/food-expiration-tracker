export const CATEGORIES = ["熟食","葉菜","根莖蔬菜","水果","肉類","海鮮","乳製品","蛋","醬料","飲料","剩菜","其他"] as const;

export interface RecognizedItem { name: string; category: string; confidence: number; }

export const RECOGNITION_PROMPT =
  `你是食物辨識助手。看這張冰箱/收納食物的照片,列出你看到的可食用品項。` +
  `只回 JSON,格式 {"items":[{"name":"品項中文名","category":"類別","confidence":0~1}]}。` +
  `category 只能從這幾個選:${CATEGORIES.join("、")}。看不出來就回 {"items":[]}。`;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

export function parseRecognition(raw: string): RecognizedItem[] {
  let parsed: unknown;
  try { parsed = JSON.parse(extractJson(raw)); } catch { return []; }
  const items = Array.isArray((parsed as { items?: unknown })?.items) ? (parsed as { items: unknown[] }).items : [];
  return items
    .filter((it): it is Record<string, unknown> => typeof (it as { name?: unknown })?.name === "string" && !!(it as { name: string }).name.trim())
    .map((it) => ({
      name: String(it.name).trim(),
      category: (CATEGORIES as readonly string[]).includes(it.category as string) ? (it.category as string) : "其他",
      confidence: typeof it.confidence === "number" ? it.confidence : 0,
    }));
}
