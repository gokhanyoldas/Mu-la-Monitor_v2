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

const DAM_ALIASES: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: "mumcular", name: "Mumcular Barajı", aliases: ["mumcular"] },
  { id: "geyik", name: "Geyik Barajı", aliases: ["geyik"] },
  { id: "akgedik", name: "Akgedik Barajı", aliases: ["akgedik"] },
  { id: "marmaris", name: "Marmaris (Atatürk) Barajı", aliases: ["marmaris baraj", "atatürk baraj"] },
  { id: "akkopru", name: "Akköprü Barajı ve HES", aliases: ["akköprü"] },
  { id: "bayir", name: "Bayır Barajı", aliases: ["bayır baraj", "bayır"] },
  { id: "esen1", name: "Eşen 1 Barajı ve HES", aliases: ["eşen 1", "eşen-1"] },
  { id: "esen2", name: "Eşen 2 Barajı ve HES", aliases: ["eşen 2", "eşen-2"] },
];

function sendJson(res: VercelResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(body);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isValidExternalUrl(uri: unknown): uri is string {
  if (typeof uri !== "string") return false;
  try {
    const parsed = new URL(uri.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return Boolean(host && host.includes(".") && host !== "localhost" && host !== "127.0.0.1");
  } catch {
    return false;
  }
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

function matchDam(rawName: unknown): { id: string; name: string } | null {
  if (typeof rawName !== "string") return null;
  const low = rawName.toLocaleLowerCase("tr-TR");
  for (const d of DAM_ALIASES) {
    if (d.aliases.some((a) => low.includes(a))) {
      return { id: d.id, name: d.name };
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const topic = body.topic === "transport_infra" ? "transport_infra" : "environment_dams";

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "GEMINI_API_KEY tanımlı değil.",
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const prompt =
      topic === "environment_dams"
        ? `Google Arama aracını kullanarak şu sorguyu tara:
"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı

GÖREV:
- Yalnızca arama sonuçlarında doğrudan yer alan doğrulanmış haber veya resmi kurumlardan (Anter Haber, AA, MUSKİ, DSİ, DHA, İHA, Muğla yerel basını) Muğla barajlarının güncel doluluk yüzdelerini çıkar.
- Asla tahmin veya uydurma oran üretme. Kaynak URL'si bulunmayan kaydı ekleme.
- Şanlıurfa Atatürk Barajı verilerini karıştırma; yalnızca Muğla Marmaris Atatürk Barajı için veri ekle.
- SADECE aşağıdaki JSON yapısını döndür:
{
  "damUpdates": [
    {
      "damName": "Mumcular Barajı | Geyik Barajı | Akgedik Barajı | Marmaris (Atatürk) Barajı | Akköprü Barajı ve HES | Bayır Barajı",
      "occupancyRate": 80,
      "sourceName": "Anter Haber | AA | MUSKİ | DSİ | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium",
      "headline": "Kısa haber başlığı"
    }
  ]
}`
        : `Google Arama aracını kullanarak şu sorguyu tara:
"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik

GÖREV:
- Son günlerde Muğla, Bodrum, Marmaris, Fethiye, Milas, Menteşe ilçelerinde yaşanan doğrulanmış yol çalışması, isale hattı patlaması/su arızası veya trafik duyurularını çıkar.
- Asla uydurma kayıt üretme; yalnızca gerçek kaynak URL'si bulunan olayları döndür (en fazla 6 kayıt).
- SADECE aşağıdaki JSON yapısını döndür:
{
  "incidents": [
    {
      "title": "Kısa ve net olay başlığı",
      "district": "Bodrum | Marmaris | Menteşe | Milas | Fethiye | Datça | Dalaman | Ortaca | Köyceğiz | Yatağan | Ula | Seydikemer | Kavaklıdere",
      "category": "yol_calismasi | isale_hatti | trafik",
      "status": "devam | tamamlandı | uyarı",
      "sourceName": "Kaynak adı",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
    const groundingSources = chunks
      .map((c: { web?: { uri?: string; title?: string } }) => ({
        uri: c.web?.uri || "",
        title: c.web?.title || "",
      }))
      .filter((s) => isValidExternalUrl(s.uri));

    const fallbackUrl = groundingSources[0]?.uri;
    const nowIso = new Date().toISOString();

    if (topic === "environment_dams") {
      const parsed = extractJsonFromText<{ damUpdates?: Array<Record<string, unknown>> }>(
        response.text ?? ""
      );
      const rawList = Array.isArray(parsed?.damUpdates) ? parsed!.damUpdates : [];
      const damUpdates = rawList
        .map((item) => {
          const matched = matchDam(item.damName);
          const rate = Number(item.occupancyRate);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if (!matched || !Number.isFinite(rate) || rate < 0 || rate > 100 || !url) return null;
          const dateStr =
            typeof item.publishedDate === "string" && !Number.isNaN(new Date(item.publishedDate).getTime())
              ? new Date(item.publishedDate).toISOString()
              : nowIso;
          return {
            damId: matched.id,
            damName: matched.name,
            occupancyRate: Math.round(rate * 10) / 10,
            sourceName:
              typeof item.sourceName === "string" && item.sourceName.trim()
                ? item.sourceName.trim().slice(0, 60)
                : "Yerel Basın/DSİ",
            sourceUrl: url,
            measuredAt: dateStr,
            confidence: item.confidence === "medium" ? "medium" : "high",
            headline: typeof item.headline === "string" ? item.headline.trim().slice(0, 160) : undefined,
          };
        })
        .filter(Boolean);

      return sendJson(res, 200, {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        damUpdates,
        groundingSources,
      });
    }

    const parsed = extractJsonFromText<{ incidents?: Array<Record<string, unknown>> }>(
      response.text ?? ""
    );
    const rawIncidents = Array.isArray(parsed?.incidents) ? parsed!.incidents : [];
    const transportIncidents = rawIncidents
      .map((item, idx) => {
        const title = typeof item.title === "string" ? item.title.trim().slice(0, 140) : "";
        const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
        if (!title || !url) return null;
        const publishedAt =
          typeof item.publishedDate === "string" && !Number.isNaN(new Date(item.publishedDate).getTime())
            ? new Date(item.publishedDate).toISOString()
            : nowIso;
        return {
          id: `ti-${idx}-${Date.now()}`,
          title,
          district: typeof item.district === "string" && item.district.trim() ? item.district.trim() : "Muğla",
          category:
            item.category === "isale_hatti" || item.category === "trafik"
              ? item.category
              : "yol_calismasi",
          status:
            item.status === "tamamlandı" || item.status === "uyarı" ? item.status : "devam",
          sourceName:
            typeof item.sourceName === "string" && item.sourceName.trim()
              ? item.sourceName.trim().slice(0, 60)
              : "Yerel Basın",
          sourceUrl: url,
          publishedAt,
          confidence: item.confidence === "medium" ? "medium" : "high",
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return sendJson(res, 200, {
      ok: true,
      topic,
      model: GEMINI_MODEL,
      fetchedAt: nowIso,
      transportIncidents,
      groundingSources,
    });
  } catch (err) {
    console.error("[vercel /api/intel/topic-grounding] error:", err);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "Konu bazlı Google Search Grounding geçici olarak kullanılamıyor.",
    });
  }
}
