import { parseRecognition, RECOGNITION_PROMPT, type RecognizedItem } from "./recognition";

export async function recognizeFood(bytes: Uint8Array, contentType: string): Promise<RecognizedItem[]> {
  const base = process.env.AI_HUB_BASE_URL;
  const key = process.env.AI_HUB_API_KEY;
  const model = process.env.AI_HUB_VISION_MODEL;
  if (!base || !key || !model) return [];
  const b64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${contentType || "image/jpeg"};base64,${b64}`;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [
          { type: "text", text: RECOGNITION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ]}],
        temperature: 0,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    return parseRecognition(typeof json?.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "");
  } catch {
    return []; // failure must not block the upload flow
  }
}
