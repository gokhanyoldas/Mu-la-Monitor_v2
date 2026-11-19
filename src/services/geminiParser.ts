// src/services/geminiParser.ts
// Google AI Studio (Gemini API) ve Akıllı Heuristik Hibrit Olay Ayrıştırıcı

import { MUGLA_DISTRICTS, IncidentCategory, IncidentSeverity } from "@/data/muglaDistricts";
import { runClientGeminiPostAnalysis } from "@/services/clientGeminiFallback";

export interface ParsedIncident {
  district_name: string;
  district_id: string;
  title: string;
  summary: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  lat: number;
  lon: number;
}

// 1. Yerel Heuristik NLP Ayrıştırıcı (Yedek & Hızlı Çözümleme)
function parseLocally(rawText: string): ParsedIncident {
  const lower = rawText.toLowerCase();

  // İlçe tespiti
  let matchedDistrict = MUGLA_DISTRICTS.find(d => 
    lower.includes(d.name.toLowerCase()) || lower.includes(d.id.toLowerCase())
  );
  if (!matchedDistrict) {
    if (lower.includes("merkez")) {
      matchedDistrict = MUGLA_DISTRICTS.find(d => d.id === "mentese");
    } else {
      matchedDistrict = MUGLA_DISTRICTS[0]; // Menteşe varsayılan
    }
  }

  // Kategori tespiti
  let category: IncidentCategory = "Genel";
  if (lower.match(/yangın|itfaiye|duman|alev|orman yangını|fırtına|sel|afet|deprem/)) {
    category = "Yangın/Afet";
  } else if (lower.match(/kaza|trafik|yol|karayolu|tıkan|asfalt|şerit|konvoy|otobüs/)) {
    category = "Trafik";
  } else if (lower.match(/su|muski|baraj|patlak|boru|kanalizasyon|elektrik|kesinti|arıza/)) {
    category = "Altyapı/Su";
  } else if (lower.match(/polis|jandarma|zabıta|hırsızlık|asayiş|güvenlik|operasyon|denetim/)) {
    category = "Asayiş";
  } else if (lower.match(/turist|otel|plaj|sahil|koy|deniz|tekne|çevre|kıyı|etkinlik|festival/)) {
    category = "Turizm/Çevre";
  }

  // Önem derecesi tespiti
  let severity: IncidentSeverity = "Orta";
  if (lower.match(/acil|kritik|can kaybı|şiddetli|büyük yangın|tahliye|kırmızı alarm/)) {
    severity = "Kritik";
  } else if (lower.match(/uyarı|yoğun|önemli|tehlike|yaralı|kaza|kesinti/)) {
    severity = "Yüksek";
  } else if (lower.match(/bilgi|rutin|tamamlandı|bakım|planlı/)) {
    severity = "Düşük";
  }

  // Başlık oluşturma
  const sentences = rawText.split(/[.!?\n]/).filter(s => s.trim().length > 5);
  const firstSentence = sentences[0]?.trim() || rawText.slice(0, 60);
  const title = firstSentence.length > 50 ? `${firstSentence.slice(0, 47)}...` : firstSentence;
  const summary = rawText.trim().slice(0, 160) + (rawText.length > 160 ? "..." : "");

  return {
    district_name: matchedDistrict!.name,
    district_id: matchedDistrict!.id,
    title,
    summary,
    category,
    severity,
    lat: matchedDistrict!.lat,
    lon: matchedDistrict!.lon
  };
}

// 2. Gemini API ile Yapılandırılmış JSON Üretimi
export async function parseUnstructuredTextWithGemini(rawText: string, apiKey?: string): Promise<ParsedIncident> {
  void apiKey;

  try {
    const parsed = await runClientGeminiPostAnalysis({ text: rawText });
    if (!parsed) return parseLocally(rawText);

    const matchedDistrict = MUGLA_DISTRICTS.find(
      d => d.name.toLowerCase() === String(parsed.districtName || "").toLowerCase()
    ) || MUGLA_DISTRICTS[0];

    const validCategories: IncidentCategory[] = [
      'Yangın/Afet', 'Trafik', 'Altyapı/Su', 'Asayiş', 'Turizm/Çevre', 'Genel'
    ];
    const category: IncidentCategory = validCategories.includes(parsed.category) 
      ? parsed.category as IncidentCategory
      : 'Genel';

    const validSeverities: IncidentSeverity[] = ['Düşük', 'Orta', 'Yüksek', 'Kritik'];
    const severity: IncidentSeverity = validSeverities.includes(parsed.severity)
      ? parsed.severity as IncidentSeverity
      : 'Orta';

    return {
      district_name: matchedDistrict.name,
      district_id: matchedDistrict.id,
      title: String(parsed.summary || "Bildirim").split(/[.!?]/)[0].slice(0, 80),
      summary: String(parsed.summary || rawText.slice(0, 120)),
      category,
      severity,
      lat: matchedDistrict.lat,
      lon: matchedDistrict.lon
    };
  } catch (err) {
    console.error("Gemini parse error:", err);
    return parseLocally(rawText);
  }
}
