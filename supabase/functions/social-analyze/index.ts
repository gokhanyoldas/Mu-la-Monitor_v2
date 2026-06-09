// supabase/functions/social-analyze/index.ts
// Sentiment analysis using HuggingFace Inference API (free tier)
// Model: savasy/bert-base-turkish-sentiment-cased (Turkish BERT)
// Fallback: Enhanced keyword-based hybrid analysis

import { corsHeaders } from "../_shared/cors.ts";

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

// ─── Enhanced Keyword-based Fallback ───
function analyzeWithKeywords(texts: string[]): SentimentResult[] {
  const negativeWords = new Set([
    "kriz", "tehlike", "ölüm", "felaket", "korku", "panik", "afet", "acil",
    "alarm", "kötü", "berbat", "feci", "kaos", "düşüş", "kayıp", "çatışma",
    "işsizlik", "yoksul", "hastalık", "yangın", "suç", "cinayet", "şiddet",
    "bomba", "terör", "saldırı", "kirli", "nefret", "sorun", "problem",
    "tehdit", "zarar", "hasar", "mağdur", "şikayet", "kaza", "deprem",
    "sel", "heyelan", "çöp", "gürültü", "trafik", "sıkıntı", "zam",
  ]);
  
  const positiveWords = new Set([
    "başarı", "kazanç", "yükseliş", "güzel", "mükemmel", "harika",
    "umut", "gelişme", "iyileşme", "büyüme", "özgürlük", "inovasyon",
    "ilerleme", "fırsat", "destek", "yatırım", "proje", "açılış",
    "festival", "kutlama", "ödül", "rekor", "artış", "büyüdü",
    "modernizasyon", "yenileme", "iyileştirme", "hizmet", "kalite",
    "turizm", "güvenli", "temiz", "yeşil", "doğa", "kültür",
  ]);

  return texts.map(text => {
    const words = text.toLowerCase().split(/\s+/);
    let posCount = 0;
    let negCount = 0;
    
    for (const word of words) {
      const cleaned = word.replace(/[^a-zçğıöşü]/gi, "");
      if (positiveWords.has(cleaned)) posCount++;
      if (negativeWords.has(cleaned)) negCount++;
    }
    
    const total = posCount + negCount || 1;
    const score = (posCount - negCount) / total;
    
    let sentiment: "positive" | "negative" | "neutral";
    let confidence: number;
    
    if (score > 0.2) {
      sentiment = "positive";
      confidence = Math.min(0.85, 0.5 + score * 0.5);
    } else if (score < -0.2) {
      sentiment = "negative";
      confidence = Math.min(0.85, 0.5 + Math.abs(score) * 0.5);
    } else {
      sentiment = "neutral";
      confidence = 0.55;
    }
    
    return { text, sentiment, confidence: Math.round(confidence * 100) / 100, method: "keyword" as const };
  });
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const texts: string[] = body.texts || [];
    
    if (texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No texts provided. Send { texts: [...] }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 30 texts per request
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
