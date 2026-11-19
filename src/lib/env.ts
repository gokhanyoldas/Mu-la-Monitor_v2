// src/lib/env.ts
// Merkezi ortam değişkenleri modülüne (src/config/env.ts) uyumluluk yönlendirmesi.

export {
  ENV,
  resolveEnv,
  getGeminiApiKey,
  getAppUrl,
  getRuntimeEnvSummary,
  validateEnvAndWarn,
} from "@/config/env";
