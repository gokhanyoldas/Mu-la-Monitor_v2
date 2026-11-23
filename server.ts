import express from "express";
import path from "node:path";
import fs from "node:fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  // Healthcheck
  app.get("/api/health", (_req, res) => {
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    res.json({ ok: true, geminiConfigured, model: GEMINI_MODEL });
  });

  // Step 3: Multi-Issue Decomposition, Implicit Subtext & Multimodal Post Analysis
  app.post("/api/intel/analyze-post", async (req, res) => {
    const { text = "", imageBase64, imageMimeType, lexiconTerms = [] } = req.body ?? {};
    if (!text && !imageBase64) {
      return res.status(400).json({ ok: false, error: "Metin veya görsel sağlanmalıdır." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ok: false,
        fallback: true,
        reason: "GEMINI_API_KEY tanımlı değil; yerel NLP analizörü kullanılıyor.",
      });
    }

    try {
      const prompt = `Sen Muğla Monitör v2 Merkezi İstihbarat ve Çapraz Doğrulama Motorusun.
Aşağıdaki sahadan gelen sosyal medya paylaşımını (ve varsa ekli saha fotoğrafını) analiz et.
Bilinen Yaşayan Sözlük örnekleri: ${Array.isArray(lexiconTerms) ? lexiconTerms.slice(0, 40).join(", ") : ""}

GÖREVLER:
1. Metindeki ve görseldeki TÜM farklı alt sorunları (Multi-Issue Decomposition) ayrıştır. Örneğin yol/çamur/lacivert asfalt, dere kapanması/sel, moloz/cam kumbarası/çöp, yarım kalmış belediye projeleri (Kent Meydanı, Otopark, İçmeler Belediye binası, Huzurevi), Aydem kazı kapamaları, trafik sıkışıklığı.
2. İroni, kinaye, politik kulis eleştirisi ve dolaylı ima kalıplarını (Implicit Subtext Analyzer) açıkça deşifre et:
   - Ör: "selfie fotoları lazım değil hizmet lazım" -> PR/görünürlük vs saha icraat eleştirisi
   - Ör: "3 müdürlük / akraba kontenjanı / ithal müdür" -> Liayakat, atama ve yönetişim gerilimi
   - Ör: "Mayıs'ta turist sıva mermer izliyor" -> Turizm sezonu açılışı öncesi şantiye takvimi riski
3. Geçen veya ima edilen tüm mevki/lokaliteleri, aktörleri/unvanları ("Sn Aras"->Ahmet Aras, "Sn Ünlü"->Acar Ünlü, "Sn Mete"->Kadem Mete, Daire Başkanları vb.), proje isimlerini ve saha jargonu kelimelerini çıkar.
4. Trafik tıkanıklığı / yol kapanması / yoğunluk iddiası varsa konumunu belirle.

SADECE aşağıdaki şemada geçerli JSON döndür (ekstra açıklama yazma):
{
  "summary": "2 cümlelik yönetici özeti",
  "districtName": "İlçe adı (ör. Marmaris, Bodrum, Muğla Merkez, Yatağan, Kavaklıdere vb.)",
  "sentiment": "negative" | "neutral" | "positive",
  "sentimentScore": 0.0-1.0,
  "issues": [
    {
      "topic": "Sorun başlığı",
      "category": "altyapi_yol" | "su_sel" | "enerji_aydem" | "cevre_atik" | "belediye_proje" | "turizm_sezon" | "trafik_uyumsuzluk" | "protokol_yonetisim",
      "locality": "Mahalle veya mevki adı",
      "severity": "kritik" | "yuksek" | "orta",
      "summary": "Kısa detay"
    }
  ],
  "implicitSubtext": [
    {
      "phrase": "İmalı ifade",
      "hiddenMeaning": "Deşifre edilen gerçek anlam / eleştiri",
      "category": "pr_vs_hizmet" | "liyakat_atama" | "turizm_takvim_riski" | "kurumsal_sorumluluk",
      "targetActor": "İlgili kişi veya birim"
    }
  ],
  "extractedLocalities": ["mevki1"],
  "extractedActors": ["aktör1"],
  "extractedProjects": ["proje1"],
  "extractedJargon": ["jargon1"],
  "reportedTrafficAnomaly": {
    "detected": true | false,
    "location": "Mevki adı",
    "reason": "Tıkanıklık veya yol sorunu özeti"
  }
}

KULLANICI PAYLAŞIMI:
"""
${String(text).slice(0, 6000)}
"""`;

      const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt];
      if (imageBase64 && typeof imageBase64 === "string") {
        const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        contents.push({
          inlineData: {
            mimeType: typeof imageMimeType === "string" && imageMimeType ? imageMimeType : "image/jpeg",
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
        return res.json({
          ok: false,
          fallback: true,
          reason: "Gemini yanıtı yapılandırılmış JSON olarak ayrıştırılamadı.",
        });
      }

      return res.json({
        ok: true,
        model: GEMINI_MODEL,
        analysis: parsed,
      });
    } catch (err) {
      console.error("[/api/intel/analyze-post] error:", err);
      return res.json({
        ok: false,
        fallback: true,
        reason: "Gemini servisine geçici olarak ulaşılamadı.",
      });
    }
  });

  // Step 2: Live Social & OSINT Search Grounding Across All 13 Districts
  app.post("/api/intel/district-grounding", async (req, res) => {
    const { districtName, aliases = [], lexiconTerms = [] } = req.body ?? {};
    if (!districtName) {
      return res.status(400).json({ ok: false, error: "districtName gereklidir." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ok: false,
        fallback: true,
        reason: "GEMINI_API_KEY tanımlı değil.",
      });
    }

    try {
      const searchTerms = [districtName, ...aliases.slice(0, 4), ...lexiconTerms.slice(0, 4)].join(" ");
      const prompt = `Google Search aracını kullanarak Muğla ${districtName} ilçesi hakkında güncel sosyal medya, şikayet ve yerel gündem içeriklerini tara.
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

      return res.json({
        ok: true,
        model: GEMINI_MODEL,
        posts: Array.isArray(parsed?.posts) ? parsed!.posts : [],
        groundingSources,
      });
    } catch (err) {
      console.error("[/api/intel/district-grounding] error:", err);
      return res.json({
        ok: false,
        fallback: true,
        reason: "Google Search Grounding geçici olarak kullanılamıyor.",
      });
    }
  });

  // Topic-Based Sector Grounding (Çevre/Barajlar & Ulaşım/Altyapı) with 30-min server TTL cache
  const topicGroundingCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();
  const TOPIC_DAM_ALIASES: Array<{ id: string; name: string; aliases: string[] }> = [
    { id: "mumcular", name: "Mumcular Barajı", aliases: ["mumcular"] },
    { id: "geyik", name: "Geyik Barajı", aliases: ["geyik"] },
    { id: "akgedik", name: "Akgedik Barajı", aliases: ["akgedik"] },
    { id: "marmaris", name: "Marmaris (Atatürk) Barajı", aliases: ["marmaris baraj", "atatürk baraj"] },
    { id: "akkopru", name: "Akköprü Barajı ve HES", aliases: ["akköprü"] },
    { id: "bayir", name: "Bayır Barajı", aliases: ["bayır baraj", "bayır"] },
    { id: "esen1", name: "Eşen 1 Barajı ve HES", aliases: ["eşen 1", "eşen-1"] },
    { id: "esen2", name: "Eşen 2 Barajı ve HES", aliases: ["eşen 2", "eşen-2"] },
  ];
  const isValidExternalUrl = (uri: unknown): uri is string => {
    if (typeof uri !== "string") return false;
    try {
      const parsed = new URL(uri.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      const host = parsed.hostname.toLowerCase();
      return Boolean(host && host.includes(".") && host !== "localhost" && host !== "127.0.0.1");
    } catch {
      return false;
    }
  };
  const matchTopicDam = (rawName: unknown) => {
    if (typeof rawName !== "string") return null;
    const low = rawName.toLocaleLowerCase("tr-TR");
    for (const d of TOPIC_DAM_ALIASES) {
      if (d.aliases.some((a) => low.includes(a))) return { id: d.id, name: d.name };
    }
    return null;
  };

  app.post("/api/intel/topic-grounding", async (req, res) => {
    const topic = req.body?.topic === "transport_infra" ? "transport_infra" : "environment_dams";
    const cached = topicGroundingCache.get(topic);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ok: false,
        fallback: true,
        reason: "GEMINI_API_KEY tanımlı değil.",
      });
    }

    try {
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

      let payload: Record<string, unknown>;
      if (topic === "environment_dams") {
        const parsed = extractJsonFromText<{ damUpdates?: Array<Record<string, unknown>> }>(
          response.text ?? ""
        );
        const rawList = Array.isArray(parsed?.damUpdates) ? parsed!.damUpdates : [];
        const damUpdates = rawList
          .map((item) => {
            const matched = matchTopicDam(item.damName);
            const rate = Number(item.occupancyRate);
            const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
            if (!matched || !Number.isFinite(rate) || rate < 0 || rate > 100 || !url) return null;
            const dateStr =
              typeof item.publishedDate === "string" &&
              !Number.isNaN(new Date(item.publishedDate).getTime())
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
              headline:
                typeof item.headline === "string" ? item.headline.trim().slice(0, 160) : undefined,
            };
          })
          .filter(Boolean);

        payload = {
          ok: true,
          topic,
          model: GEMINI_MODEL,
          fetchedAt: nowIso,
          damUpdates,
          groundingSources,
        };
      } else {
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
              typeof item.publishedDate === "string" &&
              !Number.isNaN(new Date(item.publishedDate).getTime())
                ? new Date(item.publishedDate).toISOString()
                : nowIso;
            return {
              id: `ti-${idx}-${Date.now()}`,
              title,
              district:
                typeof item.district === "string" && item.district.trim()
                  ? item.district.trim()
                  : "Muğla",
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

        payload = {
          ok: true,
          topic,
          model: GEMINI_MODEL,
          fetchedAt: nowIso,
          transportIncidents,
          groundingSources,
        };
      }

      topicGroundingCache.set(topic, {
        expiresAt: Date.now() + 30 * 60 * 1000,
        payload,
      });
      return res.json(payload);
    } catch (err) {
      console.error("[/api/intel/topic-grounding] error:", err);
      return res.json({
        ok: false,
        fallback: true,
        reason: "Konu bazlı Google Search Grounding geçici olarak kullanılamıyor.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("dist/index.html not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[mugla-monitor] Express + Vite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[mugla-monitor] Server failed to start:", err);
  process.exit(1);
});
