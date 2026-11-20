import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI } from "@google/genai";

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
  const text = typeof body.text === "string" ? body.text : "";
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
  const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType : undefined;
  const lexiconTerms = Array.isArray(body.lexiconTerms) ? body.lexiconTerms : [];

  if (!text && !imageBase64) {
    return sendJson(res, 400, { ok: false, error: "Metin veya görsel sağlanmalıdır." });
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "GEMINI_API_KEY tanımlı değil; istemci yedeğine geçiliyor.",
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const prompt = `Sen Muğla Monitör v2 Merkezi İstihbarat ve Çapraz Doğrulama Motorusun.
Aşağıdaki sahadan gelen sosyal medya paylaşımını (ve varsa ekli saha fotoğrafını) analiz et.
Bilinen Yaşayan Sözlük örnekleri: ${lexiconTerms.slice(0, 40).join(", ")}

GÖREVLER:
1. Metindeki ve görseldeki TÜM farklı alt sorunları (Multi-Issue Decomposition) ayrıştır.
2. İroni, kinaye, politik kulis eleştirisi ve dolaylı ima kalıplarını (Implicit Subtext Analyzer) açıkça deşifre et.
3. Geçen veya ima edilen tüm mevki/lokaliteleri, aktörleri/unvanları, proje isimlerini ve saha jargonu kelimelerini çıkar.
4. Trafik tıkanıklığı / yol kapanması / yoğunluk iddiası varsa konumunu belirle.

SADECE geçerli JSON döndür:
{
  "summary": "2 cümlelik yönetici özeti",
  "districtName": "İlçe adı",
  "sentiment": "negative" | "neutral" | "positive",
  "sentimentScore": 0.0,
  "issues": [{ "topic": "...", "category": "altyapi_yol", "locality": "...", "severity": "yuksek", "summary": "..." }],
  "implicitSubtext": [{ "phrase": "...", "hiddenMeaning": "...", "category": "kurumsal_sorumluluk", "targetActor": "..." }],
  "extractedLocalities": [],
  "extractedActors": [],
  "extractedProjects": [],
  "extractedJargon": [],
  "reportedTrafficAnomaly": { "detected": false, "location": "", "reason": "" }
}

KULLANICI PAYLAŞIMI:
"""
${text.slice(0, 6000)}
"""`;

    const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt];
    if (imageBase64) {
      const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      contents.push({
        inlineData: {
          mimeType: imageMimeType || "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = extractJsonFromText(response.text ?? "");
    if (!parsed) {
      return sendJson(res, 200, {
        ok: false,
        fallback: true,
        reason: "Gemini yanıtı yapılandırılmış JSON olarak ayrıştırılamadı.",
      });
    }

    return sendJson(res, 200, {
      ok: true,
      model: GEMINI_MODEL,
      analysis: parsed,
    });
  } catch (err) {
    console.error("[vercel /api/intel/analyze-post] error:", err);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "Gemini servisine geçici olarak ulaşılamadı.",
    });
  }
}
