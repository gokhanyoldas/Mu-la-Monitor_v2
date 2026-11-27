// supabase/functions/protocol-scrape/index.ts
// Scrapes https://www.mugla.gov.tr/il-protokol-listesi and returns structured data

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { authorizeRequest, buildRateLimitResponse, checkRateLimit } from "../_shared/auth.ts";
import {
  extractDistrictAndRole,
  parseProtocolHtml,
  protocolMemberKey,
  validateProtocolSnapshot,
  type ProtocolRecord,
} from "./protocol-parser.ts";

const SOURCE_URL = "https://www.mugla.gov.tr/il-protokol-listesi";

const normalize = (value: unknown) =>
  (value ?? "").toString().trim().toLocaleLowerCase("tr-TR");

async function makeEvidenceKey(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req, true);
  if (preflight) return preflight;

  const authCheck = await authorizeRequest(req, {
    allowInternal: true,
    allowUser: true,
    allowCors: true,
  });
  if (!authCheck.ok) return authCheck.response;

  const rl = checkRateLimit(`protocol-scrape:${authCheck.auth.userId}`, 10, 60_000);
  if (!rl.allowed) return buildRateLimitResponse(req, rl.retryAfterSec, true);

  const cors = getCorsHeaders(req);

  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const protocol = parseProtocolHtml(html);
    const validation = validateProtocolSnapshot(protocol);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Protocol scrape rejected: ${validation.reason}`,
          validation,
          protocol: [],
          stale_snapshot_preserved: true,
        }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const scrapedAt = new Date().toISOString();
    const sbUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    let changesSummary: { added: number; removed: number; updated: number } | null = null;
    let stored = false;
    if (sbUrl && sbKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(sbUrl, sbKey);
      const { data: prev, error: readError } = await sb
        .from("protocol_members")
        .select("unvan, isim, telefon, faks, kategori, district, sira");
      if (readError) throw new Error(`Could not read previous protocol snapshot: ${readError.message}`);

      const previousByKey = new Map<string, ProtocolRecord>();
      for (const row of prev ?? []) {
        const districtRole = extractDistrictAndRole(row.unvan ?? "");
        const previous: ProtocolRecord = {
          sira: row.sira ?? "",
          unvan: row.unvan ?? "",
          isim: row.isim ?? "",
          telefon: row.telefon ?? "",
          faks: row.faks ?? "",
          kategori: row.kategori ?? "",
          district: row.district ?? districtRole.district,
          role: districtRole.role,
        };
        previousByKey.set(protocolMemberKey(previous), previous);
      }

      const changes: Array<{
        change_type: "added" | "removed" | "updated";
        unvan: string;
        isim_old: string | null;
        isim_new: string | null;
        detail: string;
        district: string | null;
        evidence_key: string;
        changed_fields: string[];
      }> = [];
      let added = 0, removed = 0, updated = 0;

      for (const m of protocol) {
        const key = protocolMemberKey(m);
        const prevRow = previousByKey.get(key);
        if (!prevRow) {
          added++;
          const evidence = {
            type: "added",
            key,
            member: [m.unvan, m.isim, m.telefon, m.faks, m.kategori, m.district],
          };
          changes.push({
            change_type: "added",
            unvan: m.unvan,
            isim_old: null,
            isim_new: m.isim,
            detail: `New protocol member: ${m.unvan} — ${m.isim}`,
            district: m.district,
            evidence_key: await makeEvidenceKey(evidence),
            changed_fields: ["member"],
          });
        } else {
          previousByKey.delete(key);
          const fields: Array<keyof ProtocolRecord> = [
            "isim", "unvan", "kategori", "telefon", "faks", "district", "sira",
          ];
          const changedFields = fields.filter((field) =>
            normalize(prevRow[field]) !== normalize(m[field])
          );
          if (changedFields.length) {
            updated++;
            const evidence = {
              type: "updated",
              key,
              before: fields.map((field) => prevRow[field]),
              after: fields.map((field) => m[field]),
            };
            changes.push({
              change_type: "updated",
              unvan: m.unvan,
              isim_old: prevRow.isim,
              isim_new: m.isim,
              detail: `Protocol member updated: ${m.unvan} — ${prevRow.isim} → ${m.isim}; fields: ${changedFields.join(", ")}`,
              district: m.district,
              evidence_key: await makeEvidenceKey(evidence),
              changed_fields: changedFields,
            });
          }
        }
      }
      for (const [key, row] of previousByKey) {
        removed++;
        changes.push({
          change_type: "removed",
          unvan: row.unvan,
          isim_old: row.isim,
          isim_new: null,
          detail: `Protocol member removed: ${row.unvan} — ${row.isim}`,
          district: row.district,
          evidence_key: await makeEvidenceKey({
            type: "removed",
            key,
            member: [row.unvan, row.isim, row.telefon, row.faks, row.kategori, row.district],
          }),
          changed_fields: ["member"],
        });
      }

      // Validation precedes this transactional replace; malformed data cannot erase the prior roster.
      const snapshotRows = protocol.map((member) => ({
        isim: member.isim,
        unvan: member.unvan,
        sira: member.sira,
        kategori: member.kategori,
        telefon: member.telefon,
        faks: member.faks,
        district: member.district,
      }));
      const { data: replacedCount, error: replaceError } = await sb.rpc(
        "replace_protocol_members_snapshot",
        { p_members: snapshotRows }
      );
      if (replaceError) throw new Error(`Could not replace protocol snapshot: ${replaceError.message}`);
      if (Number(replacedCount) !== protocol.length) {
        throw new Error(`Protocol snapshot replacement count mismatch: ${replacedCount}/${protocol.length}`);
      }

      if (changes.length) {
        const { error: changesError } = await sb.from("protocol_changes").insert(
          changes.map(({ evidence_key: _key, changed_fields: _fields, ...change }) => ({
            ...change,
            scraped_at: scrapedAt,
          }))
        );
        if (changesError) throw new Error(`Could not store protocol changes: ${changesError.message}`);

        const { data: priorAlerts, error: alertsReadError } = await sb
          .from("alert_events")
          .select("metadata")
          .eq("type", "governance")
          .eq("source", "Protokol İzleme");
        if (alertsReadError) throw new Error(`Could not read protocol alert evidence: ${alertsReadError.message}`);
        const existingEvidence = new Set(
          (priorAlerts ?? []).map((row) => row.metadata?.evidence_key).filter(Boolean)
        );
        const alerts = changes
          .filter((change) => !existingEvidence.has(change.evidence_key))
          .map((change) => ({
            type: "governance",
            severity: "medium",
            title: `Protocol change: ${change.unvan}`,
            body: change.detail,
            source: "Protokol İzleme",
            metadata: {
              change_type: change.change_type,
              district: change.district,
              evidence_key: change.evidence_key,
              changed_fields: change.changed_fields,
              source_url: SOURCE_URL,
            },
          }));
        if (alerts.length) {
          const { error: alertsError } = await sb.from("alert_events").insert(alerts);
          if (alertsError?.code === "23505") {
            const { data: latestAlerts, error: retryReadError } = await sb
              .from("alert_events")
              .select("metadata")
              .eq("type", "governance")
              .eq("source", "Protokol İzleme");
            if (retryReadError) throw new Error(`Could not retry protocol alert evidence: ${retryReadError.message}`);
            const latestEvidence = new Set(
              (latestAlerts ?? []).map((row) => row.metadata?.evidence_key).filter(Boolean)
            );
            const retryAlerts = alerts.filter((alert) => !latestEvidence.has(alert.metadata.evidence_key));
            if (retryAlerts.length) {
              const { error: retryError } = await sb.from("alert_events").insert(retryAlerts);
              if (retryError && retryError.code !== "23505") {
                throw new Error(`Could not store protocol alerts: ${retryError.message}`);
              }
            }
          } else if (alertsError) {
            throw new Error(`Could not store protocol alerts: ${alertsError.message}`);
          }
        }
      }
      changesSummary = { added, removed, updated };
      const { error: statusError } = await sb.from("protocol_scrape_status").upsert({
        id: true,
        scraped_at: scrapedAt,
        member_count: protocol.length,
        complete: true,
        source: SOURCE_URL,
      }, { onConflict: "id" });
      if (statusError) throw new Error(`Could not record successful protocol scrape: ${statusError.message}`);
      stored = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocol,
        count: protocol.length,
        member_count: protocol.length,
        complete: stored,
        stored,
        changes: changesSummary,
        source: SOURCE_URL,
        scraped_at: scrapedAt,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Protocol scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error), protocol: [] }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
