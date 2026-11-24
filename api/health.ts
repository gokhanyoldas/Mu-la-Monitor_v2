import type { IncomingMessage, ServerResponse } from "node:http";

type VercelRequest = IncomingMessage & { method?: string };
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const payload = { ok: true, geminiConfigured, model, runtime: "vercel-serverless" };

  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
