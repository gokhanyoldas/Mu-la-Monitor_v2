// Server-side Gemini proxy istemcisi.
// Tarayıcı hiçbir zaman GEMINI_API_KEY taşımaz; tüm çağrılar /api/intel/* üzerinden yapılır.

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (typeof fetch !== "function") return null;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 15_000) : null;

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as T & { ok?: boolean };
    return payload?.ok === false ? null : payload;
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export async function runClientGeminiPostAnalysis(params: {
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  lexiconTerms?: string[];
}): Promise<Record<string, unknown> | null> {
  const response = await postJson<{ ok?: boolean; analysis?: Record<string, unknown> }>(
    "/api/intel/analyze-post",
    params,
  );
  return response?.analysis && typeof response.analysis === "object" ? response.analysis : null;
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
  const response = await postJson<ClientGroundingResult & { ok?: boolean }>(
    "/api/intel/district-grounding",
    params,
  );

  if (!response || !Array.isArray(response.posts)) return null;
  return {
    posts: response.posts,
    groundingSources: Array.isArray(response.groundingSources) ? response.groundingSources : [],
  };
}

export async function runClientGeminiProtocolNode(params: {
  node: unknown;
  connections: unknown[];
}): Promise<{ bullets?: unknown } | null> {
  const response = await postJson<{ ok?: boolean; analysis?: { bullets?: unknown } }>(
    "/api/intel/protocol-node",
    params,
  );
  return response?.analysis && typeof response.analysis === "object" ? response.analysis : null;
}
