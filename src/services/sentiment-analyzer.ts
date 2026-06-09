export type Sentiment = "positive" | "neutral" | "negative" | "critical";

interface SentimentScore {
  sentiment: Sentiment;
  confidence: number;
  score: number;
}

class SentimentAnalyzer {
  private negativeKeywords = [
    "kriz",
    "tehdit",
    "tehlikeli",
    "ölüm",
    "ölümlü",
    "yaralı",
    "felaket",
    "korku",
    "panik",
    "afet",
    "acil",
    "hayati",
    "kritik",
    "alarm",
    "uyarı",
    "hata",
    "arıza",
    "kötü",
    "berbat",
    "feci",
    "kaos",
    "düşün",
    "düşüş",
    "kayıp",
    "kaybetti",
    "kaybetme",
    "çatışma",
    "savaş",
    "işsizlik",
    "işsiz",
    "yoksul",
    "fakir",
    "hastalık",
    "hasta",
    "virüs",
    "epidemi",
    "pandemi",
    "infeksyon",
    "yangın",
    "suç",
    "cinayet",
    "katil",
    "hırsız",
    "tecavüz",
    "şiddet",
    "şiddetli",
    "bomba",
    "terör",
    "terörist",
    "saldırı",
    "saldıran",
    "kaçak",
    "kaçakçı",
    "dilenci",
    "evsiz",
    "çukur",
    "çöp",
    "kirli",
    "nefret",
    "ayrımcılık",
    "ayrımcı",
    "ırkçılık",
    "ırkçı",
    "cinsiyetçi",
    "homofobik",
    "dezenformasyon",
    "yalan",
    "yanlış",
    "sahte",
    "propaganda",
    "manipülasyon",
    "manipüle",
  ];

  private positiveKeywords = [
    "başarı",
    "başarılı",
    "başardı",
    "kazanç",
    "kazandı",
    "yükseldi",
    "yükseliş",
    "iyi",
    "harika",
    "güzel",
    "mükemmel",
    "enfes",
    "görkemli",
    "parlak",
    "parlayan",
    "parlıyor",
    "parlayacak",
    "vaat",
    "umut",
    "ümit",
    "iyilik",
    "merhamet",
    "sevgi",
    "aşk",
    "barış",
    "barışçıl",
    "huzur",
    "mutlu",
    "mutluluk",
    "sevinç",
    "sevinçli",
    "fırsat",
    "gelişme",
    "gelişti",
    "gelişmeler",
    "gelişmek",
    "iyileşti",
    "iyileşme",
    "iyileştirme",
    "iyileştirildi",
    "iyileştir",
    "iyileştirecek",
    "büyüme",
    "büyüdü",
    "büyüyor",
    "büyüyecek",
    "özgürlük",
    "özgür",
    "hürriyet",
    "hürr",
    "inovasyon",
    "inovativ",
    "teknoloji",
    "teknolojik",
    "ilerleme",
    "ilerledi",
    "ilerliyor",
    "ilerleyecek",
    "ilerlemek",
    "ileri",
    "ileri geri",
    "emek",
    "çalışkan",
    "çalışmak",
    "çalışmalar",
    "çalışma",
  ];

  private criticalKeywords = [
    "ölüm",
    "ölümlü",
    "felaket",
    "afet",
    "acil",
    "hayati",
    "kritik",
    "alarm",
    "kaos",
    "savaş",
    "çatışma",
    "yangın",
    "suç",
    "cinayet",
    "bomba",
    "terör",
    "terörist",
    "saldırı",
    "virüs",
    "epidemi",
    "pandemi",
    "infeksyon",
    "hastalık",
  ];

  analyzeSentiment(text: string): SentimentScore {
    const normalized = text.toLowerCase().trim();

    const criticalCount = this.countOccurrences(normalized, this.criticalKeywords);
    const negativeCount = this.countOccurrences(
      normalized,
      this.negativeKeywords
    );
    const positiveCount = this.countOccurrences(
      normalized,
      this.positiveKeywords
    );

    if (criticalCount > 0) {
      return {
        sentiment: "critical",
        confidence: 0.95,
        score: -1.0,
      };
    }

    const negativeWeight = 1.0;
    const positiveWeight = 0.8;

    const score =
      (positiveCount * positiveWeight - negativeCount * negativeWeight) /
      (Math.max(positiveCount + negativeCount, 1));

    let sentiment: Sentiment;
    let confidence: number;

    if (score > 0.3) {
      sentiment = "positive";
      confidence = Math.min(0.95, 0.5 + score);
    } else if (score < -0.3) {
      sentiment = "negative";
      confidence = Math.min(0.95, 0.5 + Math.abs(score));
    } else {
      sentiment = "neutral";
      confidence = 0.6;
    }

    return {
      sentiment,
      confidence: Math.round(confidence * 100) / 100,
      score: Math.round(score * 100) / 100,
    };
  }

  private countOccurrences(text: string, keywords: string[]): number {
    return keywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  analyzeMultiple(texts: string[]): SentimentScore[] {
    return texts.map((text) => this.analyzeSentiment(text));
  }

  getAverageSentiment(texts: string[]): {
    sentiment: Sentiment;
    confidence: number;
    scores: SentimentScore[];
  } {
    const scores = this.analyzeMultiple(texts);

    const avgScore =
      scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const avgConfidence =
      scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;

    let sentiment: Sentiment;
    if (avgScore > 0.3) {
      sentiment = "positive";
    } else if (avgScore < -0.3) {
      sentiment = "negative";
    } else if (scores.some((s) => s.sentiment === "critical")) {
      sentiment = "critical";
    } else {
      sentiment = "neutral";
    }

    return {
      sentiment,
      confidence: Math.round(avgConfidence * 100) / 100,
      scores,
    };
  }

  detectCrisisIndicators(text: string): string[] {
    const indicators: string[] = [];
    const normalized = text.toLowerCase();

    this.criticalKeywords.forEach((keyword) => {
      if (normalized.includes(keyword)) {
        indicators.push(keyword);
      }
    });

    return [...new Set(indicators)];
  }

  getKeywordFrequency(text: string): Record<string, number> {
    const normalized = text.toLowerCase();
    const frequency: Record<string, number> = {};

    [...this.negativeKeywords, ...this.positiveKeywords].forEach(
      (keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          frequency[keyword] = matches.length;
        }
      }
    );

    return Object.fromEntries(
      Object.entries(frequency).sort((a, b) => b[1] - a[1])
    );
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
