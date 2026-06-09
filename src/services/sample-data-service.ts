// Stub: sample-data-service (mock data removed, real data via Edge Functions)
import { IntelligenceItem } from "./osint-data-manager";

export function generateMuglaSampleData(): IntelligenceItem[] {
  return [];
}

export function getCategoryStats(feed: IntelligenceItem[] = []) {
  // Gracefully filter based on categories or tags
  const security = feed.filter(item => 
    item.category === "threat" || 
    item.category === "alert" || 
    item.tags?.some(t => ["güvenlik", "security", "threat", "tehdit", "kriz", "yangın", "deprem"].includes(t.toLowerCase()))
  );

  const weather = feed.filter(item => 
    item.tags?.some(t => ["hava", "weather", "air", "deprem", "earthquake", "environment", "baraj", "dam"].includes(t.toLowerCase()))
  );

  const economy = feed.filter(item => 
    item.category === "opportunity" || 
    item.tags?.some(t => ["ekonomi", "economy", "tourism", "turizm", "para", "otel"].includes(t.toLowerCase()))
  );

  const health = feed.filter(item => 
    item.tags?.some(t => ["sağlık", "health", "hastane", "kamu", "belediye"].includes(t.toLowerCase()))
  );

  return {
    security: { items: security, count: security.length, trend: "stable" as const },
    weather: { items: weather, count: weather.length, trend: "stable" as const },
    economy: { items: economy, count: economy.length, trend: "stable" as const },
    health: { items: health, count: health.length, trend: "stable" as const },
    news: { count: feed.filter(i => i.category === "news").length, trend: "stable" as const },
    social: { count: feed.filter(i => i.category === "social").length, trend: "stable" as const },
    alert: { count: feed.filter(i => i.category === "alert").length, trend: "stable" as const },
    threat: { count: feed.filter(i => i.category === "threat").length, trend: "stable" as const },
    opportunity: { count: feed.filter(i => i.category === "opportunity").length, trend: "stable" as const },
  };
}

