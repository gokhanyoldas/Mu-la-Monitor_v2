// supabase/functions/social-cron/index.ts
// Scheduled social data collection (invoked by external cron or Supabase pg_cron)
// Collects data every 15 minutes, persists to DB
// Can be triggered: (1) Supabase pg_cron (2) External scheduler (3) Manual call

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get active keywords from DB
    const { data: keywordsData } = await supabase
      .from("social_keywords")
      .select("keyword")
      .eq("is_active", true);

    const keywords = keywordsData?.map(k => k.keyword) || [
      "Muğla", "Bodrum", "Fethiye", "Marmaris", "Milas", "Datça"
    ];

    // 2. Call social-collect function (internal invocation)
    const { data: collectResult, error: collectError } = await supabase.functions.invoke("social-collect", {
      body: { keywords, platforms: ["news", "reddit", "eksisozluk"] },
    });

    if (collectError) {
      throw new Error(`Collection failed: ${collectError.message}`);
    }

    const posts = collectResult?.data?.posts || [];
    const total = posts.length;

    // 3. If we have posts, run sentiment analysis
    let analyzed = 0;
    if (total > 0) {
      const texts = posts.slice(0, 30).map((p: any) => p.content);
      
      const { data: analyzeResult, error: analyzeError } = await supabase.functions.invoke("social-analyze", {
        body: { texts },
      });

      if (!analyzeError && analyzeResult?.data?.results) {
        analyzed = analyzeResult.data.results.length;

        // Update posts with sentiment in DB
        for (let i = 0; i < Math.min(posts.length, analyzeResult.data.results.length); i++) {
          const post = posts[i];
          const sentiment = analyzeResult.data.results[i];
          
          await supabase
            .from("social_posts")
            .update({
              sentiment: sentiment.sentiment,
              sentiment_confidence: sentiment.confidence,
              sentiment_method: sentiment.method,
              analyzed_at: new Date().toISOString(),
            })
            .eq("platform", post.platform)
            .eq("content", post.content);
        }

        // 4. Update trend data with sentiment counts
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

        const posCount = analyzeResult.data.results.filter((r: any) => r.sentiment === "positive").length;
        const negCount = analyzeResult.data.results.filter((r: any) => r.sentiment === "negative").length;
        const neuCount = analyzeResult.data.results.filter((r: any) => r.sentiment === "neutral").length;

        // Upsert hourly trend
        await supabase.from("social_trends").upsert({
          period_start: periodStart.toISOString(),
          period_end: new Date(periodStart.getTime() + 3600000).toISOString(),
          period_type: "hourly",
          mention_count: total,
          positive_count: posCount,
          negative_count: negCount,
          neutral_count: neuCount,
          top_keywords: keywords.slice(0, 5),
          avg_confidence: analyzeResult.data.summary?.avg_confidence || 0,
        }, { onConflict: "period_start,period_type" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        collected: total,
        analyzed,
        keywords_used: keywords.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cron error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
