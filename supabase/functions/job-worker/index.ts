// job-worker — job_queue'daki bekleyen işleri atomik olarak alıp işler.
// claim_jobs() RPC'si FOR UPDATE SKIP LOCKED kullandığından iki worker aynı
// işi alamaz; crash durumunda kilit düşer ve iş sonraki turda tekrar denenir.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";

const MAX_BATCH = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = getServiceClient();
  if (!sb) {
    return new Response(JSON.stringify({ ok: false, error: "no service client" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: jobs, error } = await sb.rpc("claim_jobs", { p_limit: MAX_BATCH });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: { id: number; status: string }[] = [];
  for (const job of jobs ?? []) {
    try {
      // Şu an tek iş tipi: twitter_fetch — hedef fonksiyonu yeniden çağır
      if (job.job_type === "twitter_fetch") {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitter-collect`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(job.payload ?? {}),
        });
        if (resp.ok) {
          await sb.from("job_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", job.id);
          results.push({ id: job.id, status: "done" });
        } else if (resp.status === 429) {
          // Hâlâ rate-limited: backoff ile tekrar kuyruğa
          await sb.from("job_queue").update({
            status: "pending",
            run_after: new Date(Date.now() + 15 * 60e3).toISOString(),
          }).eq("id", job.id);
          results.push({ id: job.id, status: "requeued" });
        } else {
          throw new Error(`target returned ${resp.status}`);
        }
      } else {
        await sb.from("job_queue").update({ status: "failed", last_error: `unknown job_type: ${job.job_type}`, processed_at: new Date().toISOString() }).eq("id", job.id);
        results.push({ id: job.id, status: "failed" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const exhausted = (job.attempts ?? 1) >= (job.max_attempts ?? 3);
      await sb.from("job_queue").update({
        status: exhausted ? "failed" : "pending",
        last_error: msg,
        run_after: exhausted ? null : new Date(Date.now() + 5 * 60e3 * (job.attempts ?? 1)).toISOString(),
        processed_at: exhausted ? new Date().toISOString() : null,
      }).eq("id", job.id);
      results.push({ id: job.id, status: exhausted ? "failed" : "retry" });
    }
  }

  return new Response(JSON.stringify({ ok: true, claimed: jobs?.length ?? 0, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
