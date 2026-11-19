// src/services/geminiParser.ts
// Google AI Studio (Gemini API) ve Akıllı Heuristik Hibrit Olay Ayrıştırıcı

import { MUGLA_DISTRICTS, IncidentCategory, IncidentSeverity } from "@/data/muglaDistricts";
import { ENV } from "@/config/env";

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
  const effectiveKey = apiKey || ENV.VITE_GEMINI_API_KEY;

  if (!effectiveKey) {
    // API anahtarı yoksa yerel zeki motor devreye girer
    return parseLocally(rawText);
  }

  try {
    const districtNames = MUGLA_DISTRICTS.map(d => d.name).join(", ");

    const prompt = `
Sen Muğla ili için çalışan kıdemli bir Coğrafi Bilgi Sistemleri (GIS) ve Kentsel İstihbarat analistisin.
Aşağıda dış kaynaklardan veya haber bülteninden gelen ham metin verilmiştir:
"""${rawText}"""

GÖREVİN:
1. Bu metnin Muğla'nın hangi ilçesiyle ilgili olduğunu tespit et. Sadece şu 13 ilçeden birini seç: [${districtNames}]. Eğer ilçe açıkça belirtilmemişse "Menteşe" olarak ata.
2. Metni şu kategorilerden birine sınıflandır: 'Yangın/Afet', 'Trafik', 'Altyapı/Su', 'Asayiş', 'Turizm/Çevre', 'Genel'.
3. Önem derecesini belirle: 'Düşük', 'Orta', 'Yüksek', 'Kritik'.
4. Başlık (en fazla 8-10 kelime) ve en fazla 2 cümlelik kurumsal bir özet çıkar.

Yalnızca ve sadece şu JSON formatında cevap ver (hiçbir markdown etiketi veya yorum ekleme):
{
  "district_name": "İlçe Adı",
  "title": "Kısa ve Net Başlık",
  "summary": "İki cümlelik net operasyonel özet.",
  "category": "Kategori",
  "severity": "Önem Derecesi"
}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${effectiveKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      console.warn("Gemini API çağrısı başarısız oldu, yerel ayrıştırıcı kullanılıyor.");
      return parseLocally(rawText);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) return parseLocally(rawText);

    const parsed = JSON.parse(textContent);

    const matchedDistrict = MUGLA_DISTRICTS.find(
      d => d.name.toLowerCase() === (parsed.district_name || "").toLowerCase()
    ) || MUGLA_DISTRICTS[0];

    const validCategories: IncidentCategory[] = [
      'Yangın/Afet', 'Trafik', 'Altyapı/Su', 'Asayiş', 'Turizm/Çevre', 'Genel'
    ];
    const category: IncidentCategory = validCategories.includes(parsed.category) 
      ? parsed.category 
      : 'Genel';

    const validSeverities: IncidentSeverity[] = ['Düşük', 'Orta', 'Yüksek', 'Kritik'];
    const severity: IncidentSeverity = validSeverities.includes(parsed.severity)
      ? parsed.severity
      : 'Orta';

    return {
      district_name: matchedDistrict.name,
      district_id: matchedDistrict.id,
      title: parsed.title || "Bildirim",
      summary: parsed.summary || rawText.slice(0, 120),
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
