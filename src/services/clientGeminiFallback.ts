// src/services/clientGeminiFallback.ts
// Tier 2 Smart Fallback: Eğer /api/intel/* rotasından 404 veya ağ hatası dönerse
// ve istemcide VITE_GEMINI_API_KEY (veya process.env.GEMINI_API_KEY) tanımlıysa
// doğrudan @google/genai SDK üzerinden multimodal analiz & Google Search Grounding çalıştırır.

import { ENV } from "@/config/env";

const CLIENT_GEMINI_MODEL = "gemini-4-hydrogen";

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

export async function runClientGeminiPostAnalysis(params: {
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  lexiconTerms?: string[];
}): Promise<Record<string, unknown> | null> {
  const apiKey = ENV.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const lexiconSample = Array.isArray(params.lexiconTerms)
      ? params.lexiconTerms.slice(0, 40).join(", ")
      : "";

    const prompt = `Sen Muğla Monitör v2 Merkezi İstihbarat ve Çapraz Doğrulama Motorusun.
Aşağıdaki sahadan gelen sosyal medya paylaşımını (ve varsa ekli saha fotoğrafını) analiz et.
Bilinen Yaşayan Sözlük örnekleri: ${lexiconSample}

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
${String(params.text || "").slice(0, 6000)}
"""`;

    const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt];
    if (params.imageBase64 && typeof params.imageBase64 === "string") {
      const cleanBase64 = params.imageBase64.includes(",")
        ? params.imageBase64.split(",")[1]
        : params.imageBase64;
      contents.push({
        inlineData: {
          mimeType: params.imageMimeType || "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: CLIENT_GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = extractJsonFromText<Record<string, unknown>>(response.text ?? "");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("[Tier-2 Client Gemini analyze-post] fallback tetiklendi:", err);
    return null;
  }
}

export interface ClientGroundingResult {
  posts: Array<{
    platform?: string;
    author?: string;
    content?: string;
    sentiment?: string;
    url?: string;
    topics?: string[];
  }>;
  groundingSources: Array<{ uri: string; title: string }>;
}

export async function runClientGeminiDistrictGrounding(params: {
  districtName: string;
  aliases?: string[];
  lexiconTerms?: string[];
}): Promise<ClientGroundingResult | null> {
  const apiKey = ENV.VITE_GEMINI_API_KEY;
  if (!apiKey || !params.districtName) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const searchTerms = [
      params.districtName,
      ...(params.aliases ?? []).slice(0, 4),
      ...(params.lexiconTerms ?? []).slice(0, 4),
    ].join(" ");

    const prompt = `Google Search aracını kullanarak Muğla ${params.districtName} ilçesi hakkında güncel sosyal medya, şikayet ve yerel gündem içeriklerini tara.
Özellikle şu kaynak türlerini araştır: site:x.com OR site:instagram.com OR site:facebook.com OR site:sikayetvar.com OR site:eksisozluk.com ${searchTerms} Muğla belediye altyapı su elektrik yol turizm.

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
      model: CLIENT_GEMINI_MODEL,
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
      .filter((s) => Boolean(s.uri));

    const parsed = extractJsonFromText<{ posts?: ClientGroundingResult["posts"] }>(
      response.text ?? ""
    );

    const posts = Array.isArray(parsed?.posts) ? parsed!.posts : [];
    if (posts.length === 0 && groundingSources.length === 0) {
      return null;
    }

    return { posts, groundingSources };
  } catch (err) {
    console.warn("[Tier-2 Client Gemini district-grounding] fallback tetiklendi:", err);
    return null;
  }
}
