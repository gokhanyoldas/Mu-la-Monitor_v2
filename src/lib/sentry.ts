// sentry.ts

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const IS_PROD = import.meta.env.PROD;
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

let realSentry: any = null;

class MockScope {
  tags: Record<string, string> = {};
  contexts: Record<string, any> = {};

  setTag(key: string, value: string) {
    this.tags[key] = value;
  }

  setContext(key: string, context: any) {
    this.contexts[key] = context;
  }
}

export const Sentry = {
  init(options: any) {
    if (realSentry) {
      realSentry.init(options);
    } else {
      console.log("[Sentry Mock] Init called with options", options);
    }
  },

  browserTracingIntegration() {
    if (realSentry) {
      return realSentry.browserTracingIntegration();
    }
    return {};
  },

  replayIntegration(options?: any) {
    if (realSentry) {
      return realSentry.replayIntegration(options);
    }
    return {};
  },

  captureException(error: any, ctx?: any) {
    if (realSentry) {
      return realSentry.captureException(error, ctx);
    }
    console.error("[Sentry Mock] Exception captured:", error, ctx);
    return "mock-err-" + Math.random().toString(36).substring(2, 9);
  },

  withScope(callback: (scope: any) => void) {
    if (realSentry) {
      return realSentry.withScope(callback);
    }
    const scope = new MockScope();
    callback(scope);
    console.log("[Sentry Mock] withScope called, Scope data:", { tags: scope.tags, contexts: scope.contexts });
  }
};

export async function initSentry() {
  if (!SENTRY_DSN) {
    console.info("[Sentry] VITE_SENTRY_DSN tanımlı değil — error tracking devre dışı");
    return;
  }

  try {
    const sentryModule = await import("@sentry/react");
    realSentry = sentryModule;
    
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: IS_PROD ? "production" : "development",
      release: `mugla-monitor@${APP_VERSION}`,
      tracesSampleRate: IS_PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: IS_PROD ? 0.01 : 0,
      replaysOnErrorSampleRate: IS_PROD ? 0.1 : 0,
      integrations: [
        sentryModule.browserTracingIntegration(),
        sentryModule.replayIntegration({ maskAllText: false, blockAllMedia: true })
      ],
      ignoreErrors: ["ResizeObserver loop limit exceeded", "Network request failed", "Load failed", "Failed to fetch"],
      beforeSend(event) {
        if (event.request?.url) {
          try {
            const u = new URL(event.request.url);
            u.searchParams.delete("token");
            u.searchParams.delete("apikey");
            event.request.url = u.toString();
          } catch {}
        }
        return event;
      },
    });
  } catch (err) {
    console.warn("[Sentry] Yüklenirken veya baslatilirken hata olustu:", err);
  }
}

export function captureApiError(api: string, error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    scope.setTag("api", api);
    scope.setTag("error_type", "api_failure");
    if (context) scope.setContext("api_context", context);
    Sentry.captureException(error);
  });
}

export function captureEdgeFunctionError(fn: string, error: unknown) {
  Sentry.withScope((scope) => {
    scope.setTag("edge_function", fn);
    scope.setTag("error_type", "edge_function_error");
    Sentry.captureException(error);
  });
}

