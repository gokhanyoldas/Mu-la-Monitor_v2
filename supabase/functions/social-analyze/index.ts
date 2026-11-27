// supabase/functions/social-analyze/index.ts
// Sentiment analysis using HuggingFace Inference API (free tier)
// Model: savasy/bert-base-turkish-sentiment-cased (Turkish BERT)
// Fallback: _shared/nlp.ts (tek doğruluk kaynağı) kelime tabanlı analiz

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { authorizeRequest, buildRateLimitResponse, checkRateLimit } from "../_shared/auth.ts";
import { analyzeText } from "../_shared/nlp.ts";

interface SentimentResult {
  text: string;
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  method: "ai" | "keyword";
}

// ─── HuggingFace Inference API (Free, no key needed for public models) ───
async function analyzeWithHuggingFace(texts: string[]): Promise<SentimentResult[] | null> {
  try {
    // HuggingFace free inference API for public models
    const url = "https://api-inference.huggingface.co/models/savasy/bert-base-turkish-sentiment-cased";
    
    const results: SentimentResult[] = [];
    
    // Process in batches of 5 (rate limit friendly)
    for (let i = 0; i < texts.length; i += 5) {
      const batch = texts.slice(i, i + 5);
      
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: batch }),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.status === 503) {
        // Model is loading - wait and retry once
        await new Promise(r => setTimeout(r, 5000));
        const retry = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: batch }),
          signal: AbortSignal.timeout(20000),
        });
        if (!retry.ok) return null;
        const retryData = await retry.json();
        processBatchResults(retryData, batch, results);
      } else if (resp.ok) {
        const data = await resp.json();
        processBatchResults(data, batch, results);
      } else {
        return null; // Fallback to keyword
      }
      
      // Small delay between batches
      if (i + 5 < texts.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return results;
  } catch (e) {
    console.error("HuggingFace error:", e);
    return null;
  }
}

function processBatchResults(data: any, texts: string[], results: SentimentResult[]) {
  if (!Array.isArray(data)) return;
  
  for (let j = 0; j < data.length; j++) {
    const prediction = data[j];
    const text = texts[j] || "";
    
    if (Array.isArray(prediction)) {
      // Model returns array of [{label, score}]
      const sorted = prediction.sort((a: any, b: any) => b.score - a.score);
      const top = sorted[0];
      
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      if (top.label === "positive" || top.label === "LABEL_1") sentiment = "positive";
      else if (top.label === "negative" || top.label === "LABEL_0") sentiment = "negative";
      
      results.push({
        text,
        sentiment,
        confidence: Math.round(top.score * 100) / 100,
        method: "ai",
      });
    } else {
      results.push({ text, sentiment: "neutral", confidence: 0.5, method: "ai" });
    }
  }
}

// ─── Keyword-based Fallback (tek kaynak: _shared/nlp.ts) ────────────────────
// Yerel kelime listeleri kaldırıldı; duygu skoru ve güveni ortak NLP motorundan
// gelir — böylece toplayıcılar ve backfill ile aynı sonuçlar üretilir.
function analyzeWithKeywords(texts: string[]): SentimentResult[] {
  return texts.map(text => {
    const nlp = analyzeText(text);
    return {
      text,
      sentiment: nlp.sentiment,
      confidence: nlp.sentimentConfidence,
      method: "keyword" as const,
    };
  });
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req, true);
  if (preflight) return preflight;

  const authCheck = await authorizeRequest(req, {
    allowInternal: true,
    allowUser: true,
    allowCors: true,
  });
  if (!authCheck.ok) return authCheck.response;

  const rl = checkRateLimit(`social-analyze:${authCheck.auth.userId}`, 20, 60_000);
  if (!rl.allowed) return buildRateLimitResponse(req, rl.retryAfterSec, true);

  const cors = getCorsHeaders(req);

  try {
    const body = await req.json().catch(() => ({}));
    const rawTexts: unknown[] = Array.isArray(body.texts) ? body.texts : [];
    const texts: string[] = rawTexts
      .slice(0, 30)
      .map((t) => String(t ?? "").slice(0, 1000))
      .filter(Boolean);
    
    if (texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No texts provided. Send { texts: [...] }" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const limitedTexts = texts.slice(0, 30);
    
    // Try AI first, fallback to keywords
    let results = await analyzeWithHuggingFace(limitedTexts);
    let method = "ai";
    
    if (!results || results.length === 0) {
      results = analyzeWithKeywords(limitedTexts);
      method = "keyword_fallback";
    }

    // Calculate summary stats
    const positive = results.filter(r => r.sentiment === "positive").length;
    const negative = results.filter(r => r.sentiment === "negative").length;
    const neutral = results.filter(r => r.sentiment === "neutral").length;
    const total = results.length || 1;
    const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / total;

    return new Response(
      JSON.stringify({
        data: {
          results,
          summary: {
            total: results.length,
            positive_count: positive,
            negative_count: negative,
            neutral_count: neutral,
            positive_ratio: Math.round((positive / total) * 100) / 100,
            negative_ratio: Math.round((negative / total) * 100) / 100,
            neutral_ratio: Math.round((neutral / total) * 100) / 100,
            avg_confidence: Math.round(avgConfidence * 100) / 100,
            overall_sentiment: positive > negative ? "positive" : negative > positive ? "negative" : "neutral",
            method,
          },
          analyzed_at: new Date().toISOString(),
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
