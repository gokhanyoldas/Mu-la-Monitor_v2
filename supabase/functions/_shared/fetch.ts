// supabase/functions/_shared/fetch.ts
// Dayanıklı HTTP katmanı — tüm kazıyıcılar için ortak.
//
// Özellikler:
//  - Deneme başına AbortSignal.timeout ile kesin zaman aşımı
//  - Üstel geri çekilme + jitter (thundering herd önleme)
//  - Yalnızca geçici hatalarda (ağ hatası, 429, 5xx) yeniden deneme
//  - Sınırlı eşzamanlılık (bounded concurrency) yardımcısı
//
// Bu katman ASLA fırlatmaz; her zaman yapılandırılmış bir sonuç döner,
// böylece çağıran taraf source_health'e başarı/başarısızlık kaydedebilir.

export interface FetchWithRetryOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Deneme başına zaman aşımı (ms). Varsayılan 12_000 */
  timeoutMs?: number;
  /** İlk denemeye EK yeniden deneme sayısı. Varsayılan 1 */
  retries?: number;
  /** Geri çekilme taban süresi (ms). Varsayılan 400 */
  baseDelayMs?: number;
  /** Geri çekilme üst sınırı (ms). Varsayılan 8_000 */
  maxDelayMs?: number;
  /** Yeniden denenecek HTTP durumları. Varsayılan: 408, 425, 429, 500-599 */
  isRetryable?: (status: number) => boolean;
}

export interface FetchOutcome {
  ok: boolean;
  /** Ağ hatasında 0 */
  status: number;
  body: string;
  /** Yapılan toplam deneme sayısı */
  attempts: number;
  latencyMs: number;
  error?: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultRetryable(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500 && status <= 599;
}

/** Tam jitter'li üstel geri çekilme: base * 2^(attempt-1), [0, cap] aralığında. */
export function backoffDelayMs(
  attempt: number,
  baseDelayMs = 400,
  maxDelayMs = 8_000,
): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
}

/**
 * Zaman aşımlı, üstel geri çekilmeli HTTP isteği. Hata fırlatmaz.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<FetchOutcome> {
  const {
    method = "GET",
    headers,
    body,
    timeoutMs = 12_000,
    retries = 1,
    baseDelayMs = 400,
    maxDelayMs = 8_000,
    isRetryable = defaultRetryable,
  } = options;

  const totalAttempts = Math.max(1, retries + 1);
  const started = Date.now();
  let lastStatus = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = resp.status;

      if (resp.ok) {
        const text = await resp.text();
        return { ok: true, status: resp.status, body: text, attempts: attempt, latencyMs: Date.now() - started };
      }

      // 4xx (429 hariç) kalıcı hatadır: yeniden denemek anlamsız
      if (!isRetryable(resp.status)) {
        let snippet = "";
        try {
          snippet = (await resp.text()).slice(0, 300);
        } catch {
          // gövde okunamadı; durum kodu yeterli
        }
        return {
          ok: false,
          status: resp.status,
          body: "",
          attempts: attempt,
          latencyMs: Date.now() - started,
          error: `HTTP ${resp.status}${snippet ? `: ${snippet}` : ""}`,
        };
      }
      lastError = `HTTP ${resp.status}`;
    } catch (err) {
      lastStatus = 0;
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < totalAttempts) {
      await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs));
    }
  }

  return {
    ok: false,
    status: lastStatus,
    body: "",
    attempts: totalAttempts,
    latencyMs: Date.now() - started,
    error: lastError || "fetch failed",
  };
}

/**
 * Öğeler üzerinde sınırlı eşzamanlılıkla async işlem çalıştırır; sonuçları
 * girdi sırasıyla döner. `limit` en az 1'e kırpılır.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}
