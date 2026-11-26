import express from "express";
import path from "node:path";
import fs from "node:fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  executeTopicGrounding,
  isValidTopicKey,
  isGeminiRateLimitError,
  markGeminiRateLimited,
  RATE_LIMIT_COOLDOWN_MS,
} from "./api/intel/topic-grounding.ts";

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || "";
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
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
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

  app.post("/api/intel/protocol-node", async (req, res) => {
    const { node, connections = [] } = req.body ?? {};
    if (!node || typeof node !== "object") return res.status(400).json({ ok: false, error: "node gereklidir." });
    const ai = getGeminiClient();
    if (!ai) return res.json({ ok: false, fallback: true, reason: "GEMINI_API_KEY tanımlı değil." });
    try {
      const prompt = `Muğla protokol ve kriz ağı düğümünü analiz et. Tam olarak 3 kısa Türkçe madde üret ve yalnızca JSON döndür: {"bullets":["..."]}.\nDüğüm: ${JSON.stringify(node).slice(0, 4000)}\nBağlantılar: ${JSON.stringify(Array.isArray(connections) ? connections.slice(0, 40) : []).slice(0, 12000)}`;
      const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config: { responseMimeType: "application/json" } });
      const parsed = extractJsonFromText<{ bullets?: unknown }>(response.text ?? "");
      const bullets = Array.isArray(parsed?.bullets) ? parsed!.bullets.map(String).filter((item) => item.trim()).slice(0, 3) : [];
      if (bullets.length < 3) return res.json({ ok: false, fallback: true, reason: "Yapılandırılmış protocol yanıtı alınamadı." });
      return res.json({ ok: true, model: GEMINI_MODEL, analysis: { bullets } });
    } catch (err) {
      console.error("[/api/intel/protocol-node] error:", err);
      return res.json({ ok: false, fallback: true, reason: "Gemini servisine geçici olarak ulaşılamadı." });
    }
  });

  app.post("/api/intel/topic-grounding", async (req, res) => {
    const rawTopic = req.body && typeof req.body === "object" ? req.body.topic : undefined;
    if (!isValidTopicKey(rawTopic)) {
      return res.status(400).json({ ok: false, error: "Geçersiz konu (topic) parametresi." });
    }
    const apiKey = process.env.GEMINI_API_KEY || "";
    try {
      const payload = await executeTopicGrounding(rawTopic, apiKey);
      return res.json(payload);
    } catch (err) {
      if (isGeminiRateLimitError(err)) {
        const retryAfterMs = markGeminiRateLimited(RATE_LIMIT_COOLDOWN_MS);
        return res.json({
          ok: false,
          fallback: true,
          rateLimited: true,
          retryAfterMs,
          topic: rawTopic,
          reason:
            "Gemini API kota/hız limiti nedeniyle geçici bekleme modunda; mevcut doğrulanmış veriler korunuyor.",
        });
      }
      console.error("[/api/intel/topic-grounding] error:", err);
      return res.json({
        ok: false,
        fallback: true,
        topic: rawTopic,
        reason: "Konu bazlı Google Search Grounding geçici olarak kullanılamıyor.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
    });

    // In HMR-disabled dev mode (e.g. Cloud Run / iframe preview), Vite 8 still injects
    // <script type="module" src="/@vite/client"> whose default bundle unconditionally
    // opens a WebSocket and throws "WebSocket closed without opened.".
    // Serve a clean no-WebSocket client shim that preserves CSS injection and import.meta.hot API.
    app.get("/@vite/client", (_req, res) => {
      res.type("application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay extends HTMLElement {
  close() {
    this.remove();
  }
}
`);
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
