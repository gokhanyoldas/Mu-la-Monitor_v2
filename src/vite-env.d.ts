/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_TOMTOM_API_KEY?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY?: string;
      VITE_GEMINI_API_KEY?: string;
      VITE_TOMTOM_API_KEY?: string;
      APP_URL?: string;
      VITE_APP_URL?: string;
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_PUBLISHABLE_KEY?: string;
      VITE_SUPABASE_ANON_KEY?: string;
      VITE_APP_VERSION?: string;
      VITE_SENTRY_DSN?: string;
    }
  }
}

export {};
