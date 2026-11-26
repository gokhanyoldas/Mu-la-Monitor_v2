import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  isGeminiRateLimitError,
  getGeminiRateLimitState,
  markGeminiRateLimited,
} from "./topic-grounding";

type VercelRequest = IncomingMessage & {
  method?: string;
  body?: Record<string, unknown>;
};
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

function sendJson(res: VercelResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(body);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function extractJsonFromText<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const districtName = typeof body.districtName === "string" ? body.districtName : "";
  const aliases = Array.isArray(body.aliases) ? body.aliases.map(String) : [];
  const lexiconTerms = Array.isArray(body.lexiconTerms) ? body.lexiconTerms.map(String) : [];

  if (!districtName) {
    return sendJson(res, 400, { ok: false, error: "districtName gereklidir." });
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "GEMINI_API_KEY tanımlı değil.",
    });
  }

  const rateState = getGeminiRateLimitState();
  if (rateState.rateLimited) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      rateLimited: true,
      retryAfterMs: rateState.retryAfterMs,
      reason: "Gemini API kota/hız limiti nedeniyle geçici bekleme modunda.",
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const currentYear = new Date().getFullYear();
    const searchTerms = [districtName, ...aliases.slice(0, 4), ...lexiconTerms.slice(0, 4)].join(" ");
    const prompt = `Google Search aracını kullanarak Muğla ${districtName} ilçesi hakkında ${currentYear} güncel sosyal medya, şikayet ve yerel gündem içeriklerini tara.
Özellikle şu kaynak türlerini araştır: site:x.com OR site:instagram.com OR site:facebook.com OR site:sikayetvar.com OR site:eksisozluk.com ${searchTerms} Muğla belediye altyapı su elektrik yol turizm ${currentYear}.

Bulduğun güncel olay ve vatandaş gündemlerini aşağıdaki JSON formatında döndür (en az 3, en fazla 6 güncel madde; yalnızca SADECE JSON döndür):
{
  "posts": [
    {
      "platform": "twitter" | "instagram" | "facebook" | "sikayetvar" | "eksisozluk" | "news",
      "author": "Kaynak veya hesap",
      "content": "Bulunan güncel gündem / vatandaş bildiriminin özeti",
      "sentiment": "positive" | "negative" | "neutral",
      "url": "Varsa kaynak URL",
      "topics": ["konu1", "konu2"]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        ...(GEMINI_MODEL.startsWith("gemini-4") || GEMINI_MODEL.startsWith("gemini-3")
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
    const groundingSources = chunks
      .map((c: { web?: { uri?: string; title?: string } }) => ({
        uri: c.web?.uri || "",
        title: c.web?.title || "",
      }))
      .filter((s) => Boolean(s.uri));

    const parsed = extractJsonFromText<{
      posts?: Array<{
        platform?: string;
        author?: string;
        content?: string;
        sentiment?: string;
        url?: string;
        topics?: string[];
      }>;
    }>(response.text ?? "");

    return sendJson(res, 200, {
      ok: true,
      model: GEMINI_MODEL,
      posts: Array.isArray(parsed?.posts) ? parsed!.posts : [],
      groundingSources,
    });
  } catch (err) {
    if (isGeminiRateLimitError(err)) {
      const retryAfterMs = markGeminiRateLimited();
      console.warn(
        `[vercel /api/intel/district-grounding] Gemini 429 RESOURCE_EXHAUSTED — ${Math.round(
          retryAfterMs / 60000
        )} dk bekleme modu.`
      );
      return sendJson(res, 200, {
        ok: false,
        fallback: true,
        rateLimited: true,
        retryAfterMs,
        reason: "Gemini API kota/hız limiti nedeniyle geçici bekleme modunda.",
      });
    }
    console.error("[vercel /api/intel/district-grounding] error:", err);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "Google Search Grounding geçici olarak kullanılamıyor.",
    });
  }
}
