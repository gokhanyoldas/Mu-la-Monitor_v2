import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI } from "@google/genai";

type VercelRequest = IncomingMessage & { method?: string; body?: Record<string, unknown> };
type VercelResponse = ServerResponse & { status?: (code: number) => VercelResponse; json?: (body: unknown) => void };

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

function sendJson(res: VercelResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") return res.status(statusCode).json(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function extractJson(raw: string): { bullets?: unknown } | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned) as { bullets?: unknown }; } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)) as { bullets?: unknown }; } catch { return null; }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const node = body.node && typeof body.node === "object" ? body.node as Record<string, unknown> : null;
  const connections = Array.isArray(body.connections) ? body.connections.slice(0, 40) : [];
  if (!node) return sendJson(res, 400, { ok: false, error: "node gereklidir." });
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return sendJson(res, 200, { ok: false, fallback: true, reason: "GEMINI_API_KEY tanımlı değil." });

  try {
    const currentYear = new Date().getFullYear();
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const prompt = `Muğla protokol ve kriz ağı düğümünü ${currentYear} güncel kurumsal yapısı çerçevesinde analiz et. Tam olarak 3 kısa Türkçe madde üret ve yalnızca JSON döndür: {"bullets":["..."]}.\nDüğüm: ${JSON.stringify(node).slice(0, 4000)}\nBağlantılar: ${JSON.stringify(connections).slice(0, 12000)}`;
    const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config: { responseMimeType: "application/json" } });
    const parsed = extractJson(response.text ?? "");
    const bullets = Array.isArray(parsed?.bullets) ? parsed!.bullets.map(String).filter((item) => item.trim()).slice(0, 3) : [];
    if (bullets.length < 3) return sendJson(res, 200, { ok: false, fallback: true, reason: "Yapılandırılmış protocol yanıtı alınamadı." });
    return sendJson(res, 200, { ok: true, model: GEMINI_MODEL, analysis: { bullets } });
  } catch (error) {
    console.error("[/api/intel/protocol-node] error:", error);
    return sendJson(res, 200, { ok: false, fallback: true, reason: "Gemini servisine geçici olarak ulaşılamadı." });
  }
}
