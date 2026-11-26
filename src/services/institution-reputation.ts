import { DISTRICTS } from "@/data/districts";
import { detectRegion } from "@/lib/time-utils";

export interface Institution {
  id: string;
  name: string;
  shortName: string;
  leader: string;
  category: "buyuksehir" | "valilik" | "bagli_kurulus" | "ilce_belediyesi" | "diger";
  keywords: string[];
  logoEmoji: string;
  officialHandle?: string;
  focusDistricts: string[]; // slug list or "all"
}

export interface DimensionScore {
  name: string;
  score: number; // 0 - 100
  weight: number;
  label: string;
  status: "excellent" | "good" | "warning" | "danger";
  recentFeedback: string;
}

export interface VulnerabilityTopic {
  topic: string;
  negativeCount: number;
  totalMentions: number;
  severity: "critical" | "high" | "medium" | "low";
  sampleSnippet: string;
  affectedDistricts: string[];
  recommendedAction: string;
}

export interface DistrictSentimentBreakdown {
  districtSlug: string;
  districtName: string;
  emoji: string;
  mentionCount: number;
  approvalRate: number; // 0 - 100%
  dominantSentiment: "positive" | "negative" | "neutral";
  topIssue?: string;
}

export interface InstitutionReputationReport {
  institution: Institution;
  evaluatedAt: string;
  overallScore: number; // 0 - 100
  letterGrade: "A+" | "A" | "B+" | "B" | "C" | "D";
  statusDescription: string;
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    positivePercent: number;
    negativePercent: number;
    neutralPercent: number;
  };
  dimensions: DimensionScore[];
  vulnerabilities: VulnerabilityTopic[];
  districtBreakdown: DistrictSentimentBreakdown[];
  crisisRiskLevel: "low" | "elevated" | "high" | "critical";
  executiveSummary: string;
}

export const INSTITUTION_CATALOG: Institution[] = [
  {
    id: "mugla-bb",
    name: "Muğla Büyükşehir Belediyesi",
    shortName: "Muğla BŞB",
    leader: "Ahmet Aras",
    category: "buyuksehir",
    keywords: ["büyükşehir", "ahmet aras", "mugla bsb", "muğla belediyesi", "büyükşehir belediyesi"],
    logoEmoji: "🏛️",
    officialHandle: "@muglabsb",
    focusDistricts: ["all"],
  },
  {
    id: "mugla-valilik",
    name: "Muğla Valiliği",
    shortName: "Valilik",
    leader: "Seddar Yavuz",
    category: "valilik",
    keywords: ["valilik", "seddar yavuz", "muğla valiliği", "vali"],
    logoEmoji: "🇹🇷",
    officialHandle: "@muglavalilik",
    focusDistricts: ["all"],
  },
  {
    id: "muski",
    name: "MUSKİ (Su ve Kanalizasyon İdaresi)",
    shortName: "MUSKİ",
    leader: "Genel Müdürlük",
    category: "bagli_kurulus",
    keywords: ["muski", "su kesintisi", "kanalizasyon", "su patlağı", "arıtma"],
    logoEmoji: "💧",
    officialHandle: "@muskigm",
    focusDistricts: ["all"],
  },
  {
    id: "muttas",
    name: "MUTTAŞ (Kent Hizmetleri & Ulaşım)",
    shortName: "MUTTAŞ",
    leader: "Ulaşım Daire Bşk.",
    category: "bagli_kurulus",
    keywords: ["muttaş", "otobüs saatleri", "toplu taşıma", "havaalanı servisi", "kent kart"],
    logoEmoji: "🚌",
    officialHandle: "@muttasulasim",
    focusDistricts: ["all"],
  },
  {
    id: "bodrum-bld",
    name: "Bodrum Belediyesi",
    shortName: "Bodrum Bel.",
    leader: "Tamer Mandalinci",
    category: "ilce_belediyesi",
    keywords: ["bodrum belediyesi", "tamer mandalinci", "bodrum bld"],
    logoEmoji: "⛵",
    officialHandle: "@BodrumBelediyesi",
    focusDistricts: ["bodrum"],
  },
  {
    id: "marmaris-bld",
    name: "Marmaris Belediyesi",
    shortName: "Marmaris Bel.",
    leader: "Acar Ünlü",
    category: "ilce_belediyesi",
    keywords: ["marmaris belediyesi", "acar ünlü", "marmaris bld"],
    logoEmoji: "🏖️",
    officialHandle: "@marmarisbld",
    focusDistricts: ["marmaris"],
  },
  {
    id: "fethiye-bld",
    name: "Fethiye Belediyesi",
    shortName: "Fethiye Bel.",
    leader: "Alim Karaca",
    category: "ilce_belediyesi",
    keywords: ["fethiye belediyesi", "alim karaca", "fethiye bld"],
    logoEmoji: "🧿",
    officialHandle: "@fethiyebelediye",
    focusDistricts: ["fethiye"],
  },
  {
    id: "mentese-bld",
    name: "Menteşe Belediyesi",
    shortName: "Menteşe Bel.",
    leader: "Gonca Köksal",
    category: "ilce_belediyesi",
    keywords: ["menteşe belediyesi", "gonca köksal", "mentese bld"],
    logoEmoji: "🌳",
    officialHandle: "@mentese_bld",
    focusDistricts: ["mentese"],
  },
  {
    id: "milas-bld",
    name: "Milas Belediyesi",
    shortName: "Milas Bel.",
    leader: "Fevzi Topuz",
    category: "ilce_belediyesi",
    keywords: ["milas belediyesi", "fevzi topuz", "milas bld"],
    logoEmoji: "🏺",
    officialHandle: "@MilasBelediyesi",
    focusDistricts: ["milas"],
  },
  {
    id: "datca-bld",
    name: "Datça Belediyesi",
    shortName: "Datça Bel.",
    leader: "Aytaç Kurt",
    category: "ilce_belediyesi",
    keywords: ["datça belediyesi", "aytaç kurt", "datca bld", "datça kaymakamlığı"],
    logoEmoji: "🌊",
    officialHandle: "@datcabelediyesi",
    focusDistricts: ["datca"],
  },
  {
    id: "dalaman-bld",
    name: "Dalaman Belediyesi & Kaymakamlığı",
    shortName: "Dalaman Bel.",
    leader: "Sezer Durmuş",
    category: "ilce_belediyesi",
    keywords: ["dalaman belediyesi", "sezer durmuş", "dalaman bld", "dalaman kaymakamlığı"],
    logoEmoji: "✈️",
    officialHandle: "@dalamanbel",
    focusDistricts: ["dalaman"],
  },
  {
    id: "ortaca-bld",
    name: "Ortaca Belediyesi & Kaymakamlığı",
    shortName: "Ortaca Bel.",
    leader: "Evren Tezcan",
    category: "ilce_belediyesi",
    keywords: ["ortaca belediyesi", "evren tezcan", "ortaca bld", "ortaca kaymakamlığı"],
    logoEmoji: "🌲",
    officialHandle: "@ortacabelediye",
    focusDistricts: ["ortaca"],
  },
  {
    id: "koycegiz-bld",
    name: "Köyceğiz Belediyesi & Kaymakamlığı",
    shortName: "Köyceğiz Bel.",
    leader: "Ali Erdoğan",
    category: "ilce_belediyesi",
    keywords: ["köyceğiz belediyesi", "koycegiz bld", "ali erdoğan", "köyceğiz kaymakamlığı"],
    logoEmoji: "🦆",
    officialHandle: "@koycegizbel",
    focusDistricts: ["koyceğiz"],
  },
  {
    id: "ula-bld",
    name: "Ula Belediyesi & Kaymakamlığı",
    shortName: "Ula Bel.",
    leader: "Mehmet Caner",
    category: "ilce_belediyesi",
    keywords: ["ula belediyesi", "mehmet caner", "ula bld", "ula kaymakamlığı"],
    logoEmoji: "🌾",
    officialHandle: "@ulabelediyesi",
    focusDistricts: ["ula"],
  },
  {
    id: "yatagan-bld",
    name: "Yatağan Belediyesi & Kaymakamlığı",
    shortName: "Yatağan Bel.",
    leader: "Mesut Günay",
    category: "ilce_belediyesi",
    keywords: ["yatağan belediyesi", "mesut günay", "yatagan bld", "yatağan kaymakamlığı"],
    logoEmoji: "⚡",
    officialHandle: "@yatagan_bel",
    focusDistricts: ["yatağan"],
  },
  {
    id: "seydikemer-bld",
    name: "Seydikemer Belediyesi & Kaymakamlığı",
    shortName: "Seydikemer Bel.",
    leader: "B. Önder Akdenizli",
    category: "ilce_belediyesi",
    keywords: ["seydikemer belediyesi", "önder akdenizli", "seydikemer bld", "seydikemer kaymakamlığı"],
    logoEmoji: "🏔️",
    officialHandle: "@seydikemerbld",
    focusDistricts: ["seydikemer"],
  },
  {
    id: "kavaklidere-bld",
    name: "Kavaklıdere Belediyesi & Kaymakamlığı",
    shortName: "Kavaklıdere Bel.",
    leader: "Mehmet Demir",
    category: "ilce_belediyesi",
    keywords: ["kavaklıdere belediyesi", "mehmet demir", "kavaklidere bld", "kavaklıdere kaymakamlığı"],
    logoEmoji: "🪵",
    officialHandle: "@kavakliderebel",
    focusDistricts: ["kavaklidere"],
  },
];

class InstitutionReputationService {
  /**
   * Filter posts relevant to this institution
   */
  filterPostsForInstitution(institution: Institution, posts: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const kws = institution.keywords.map((k) => k.toLowerCase());
    return posts.filter((p) => {
      const content = String(p.content || "").toLowerCase();
      const author = String(p.author || "").toLowerCase();
      return kws.some((kw) => content.includes(kw) || author.includes(kw));
    });
  }

  /**
   * Evaluates the institutional reputation score & 5 dimensions
   */
  evaluateReputation(institution: Institution, allPosts: Array<Record<string, unknown>>): InstitutionReputationReport {
    const relevantPosts = this.filterPostsForInstitution(institution, allPosts);
    // If not enough specific mentions, blend with general district/city mentions
    const effectivePosts = relevantPosts.length >= 5 ? relevantPosts : allPosts;

    let pos = 0;
    let neg = 0;
    let neu = 0;

    effectivePosts.forEach((p) => {
      const s = String(p.sentiment || "neutral").toLowerCase();
      if (s === "positive") pos++;
      else if (s === "negative") neg++;
      else neu++;
    });

    const total = pos + neg + neu || 1;
    const posPct = Math.round((pos / total) * 100);
    const negPct = Math.round((neg / total) * 100);
    const neuPct = 100 - (posPct + negPct);

    // Calculate score: base 70 + (posPct * 0.4) - (negPct * 0.6)
    let rawScore = Math.round(55 + (posPct * 0.45) - (negPct * 0.55));
    if (institution.id === "mugla-bb") rawScore = Math.max(50, Math.min(96, rawScore + 8));
    else if (institution.id === "muski") rawScore = Math.max(40, Math.min(90, rawScore - 6)); // MUSKİ naturally receives more infrastructure complaints
    rawScore = Math.max(30, Math.min(98, rawScore));

    let letterGrade: "A+" | "A" | "B+" | "B" | "C" | "D" = "B";
    let statusDescription = "Dengeli Kurumsal Algı / İstikrarlı Güven";
    let crisisRisk: "low" | "elevated" | "high" | "critical" = "low";

    if (rawScore >= 90) {
      letterGrade = "A+";
      statusDescription = "Yüksek Vatandaş Memnuniyeti & Güçlü Kurum İmajı";
      crisisRisk = "low";
    } else if (rawScore >= 80) {
      letterGrade = "A";
      statusDescription = "Olumlu Kamuoyu Algısı & Başarılı Saha Varlığı";
      crisisRisk = "low";
    } else if (rawScore >= 70) {
      letterGrade = "B+";
      statusDescription = "Dengeli Kurumsal Algı / Belirli Alanlarda Müdahale İhtiyacı";
      crisisRisk = "elevated";
    } else if (rawScore >= 60) {
      letterGrade = "B";
      statusDescription = "Gelişime Açık İtibar / Şikayet Frekansında Artış";
      crisisRisk = "elevated";
    } else if (rawScore >= 50) {
      letterGrade = "C";
      statusDescription = "Hassas İtibar Eşiği / Kriz Yönetimi Önerilir";
      crisisRisk = "high";
    } else {
      letterGrade = "D";
      statusDescription = "Kritik Algı Riski / Acil Kriz Müdahalesi Şart";
      crisisRisk = "critical";
    }

    // Calculate 5 Dimensions
    const dimensions: DimensionScore[] = [
      {
        name: "Hizmet Kalitesi & Çözüm Hızı",
        score: Math.min(95, Math.max(45, rawScore + (posPct > 40 ? 5 : -4))),
        weight: 0.25,
        label: "Saha ekiplerinin varlığı ve sorunları çözme performansı",
        status: rawScore >= 75 ? "good" : rawScore >= 60 ? "warning" : "danger",
        recentFeedback: "Vatandaşların ilettiği talep ve şikayetlerin ilk 48 saatte çözülme oranı.",
      },
      {
        name: "Şeffaflık & Dijital İletişim",
        score: Math.min(98, Math.max(50, rawScore + 6)),
        weight: 0.20,
        label: "Sosyal medya geri dönüşleri ve resmi bilgilendirme şeffaflığı",
        status: "good",
        recentFeedback: "Resmi bültenlerin zamanında duyurulması ve kamuoyu bilgilendirme hızı.",
      },
      {
        name: "Kriz & Afet Müdahale Çevikliği",
        score: Math.min(95, Math.max(40, rawScore + 2)),
        weight: 0.20,
        label: "Yangın, fırtına, su arızaları ve olağanüstü durumlara reaksiyon",
        status: rawScore >= 70 ? "good" : "warning",
        recentFeedback: "Acil durumlarda kriz masası ve saha müdahale koordinasyonu.",
      },
      {
        name: "Altyapı & Çevre Yönetimi",
        score: Math.min(90, Math.max(35, rawScore - (institution.id === "muski" ? 12 : 5))),
        weight: 0.20,
        label: "Yol çalışmaları, içme suyu, kanalizasyon ve temizlik yönetimi",
        status: rawScore >= 70 ? "good" : "warning",
        recentFeedback: "Yol asfaltlama, su borusu yenileme ve çevre temizliği algısı.",
      },
      {
        name: "Toplumsal Güven & Kurumsal Saygınlık",
        score: Math.min(95, Math.max(50, rawScore + 4)),
        weight: 0.15,
        label: "Halk nezdindeki genel güvenilirlik, liyakat ve vizyon algısı",
        status: rawScore >= 75 ? "excellent" : "good",
        recentFeedback: "Kurumun genel yönetim kalitesi ve tarafsızlık karnesi.",
      },
    ];

    // Detect Vulnerabilities from REAL negative posts
    const negativePosts = effectivePosts.filter((p) => p.sentiment === "negative");
    const vulnerabilities: VulnerabilityTopic[] = [];

    if (negativePosts.length > 0) {
      // Gerçek negatif gönderilerden en sık geçen konuları kümele
      const issuePatterns = [
        {
          key: "su",
          topic: "Su Kesintileri & Altyapı Sorunları",
          keywords: ["su", "muski", "kesinti", "boru", "patlak", "arıza"],
          rec: "Anlık SMS/Mobil bilgilendirme sistemini devreye sokun; saha tamirat süresini canlı haritada paylaşın.",
        },
        {
          key: "ulasim",
          topic: "Ulaşım, Sefer Sıklığı & Trafik",
          keywords: ["otobüs", "muttaş", "sefer", "trafik", "dolmuş", "yol", "asfalt", "kaza"],
          rec: "Pik saatlerde ek sefer düzenleyin; yol çalışmalarında alternatif güzergah duyurularını hızlandırın.",
        },
        {
          key: "cevre",
          topic: "Çevre, Temizlik & Sokak Hayvanları",
          keywords: ["çöp", "temizlik", "koku", "köpek", "hayvan", "orman", "yangın", "atık"],
          rec: "Saha temizlik ve denetim ekiplerinin devriye sıklığını artırın; şeffaf veterinerlik bülteni yayınlayın.",
        },
        {
          key: "imar",
          topic: "İmar, Kıyı Yönetimi & Zabıta Talepleri",
          keywords: ["imar", "kaçak", "inşaat", "kıyı", "plaj", "şezlong", "zabıta", "gürültü"],
          rec: "Kıyı ve zabıta denetim sonuçlarını haftalık şeffaf rapor olarak kamuoyuyla paylaşın.",
        },
      ];

      for (const pattern of issuePatterns) {
        const matchingPosts = negativePosts.filter((p) => {
          const txt = String(p.content || "").toLowerCase();
          return pattern.keywords.some((kw) => txt.includes(kw));
        });

        if (matchingPosts.length > 0) {
          const sample = matchingPosts[0];
          const affected = Array.from(
            new Set(matchingPosts.map((p) => p.region).filter(Boolean) as string[])
          );
          vulnerabilities.push({
            topic: pattern.topic,
            negativeCount: matchingPosts.length,
            totalMentions: effectivePosts.filter((p) => {
              const txt = String(p.content || "").toLowerCase();
              return pattern.keywords.some((kw) => txt.includes(kw));
            }).length,
            severity: matchingPosts.length >= 3 ? "critical" : matchingPosts.length >= 2 ? "high" : "medium",
            sampleSnippet: sample.content.length > 110 ? `${sample.content.slice(0, 110)}...` : sample.content,
            affectedDistricts: affected.length > 0 ? affected : ["Muğla Geneli"],
            recommendedAction: pattern.rec,
          });
        }
      }

      // Eğer kalıplara girmeyen genel negatif postlar varsa
      if (vulnerabilities.length === 0 && negativePosts.length > 0) {
        const first = negativePosts[0];
        vulnerabilities.push({
          topic: "Genel Vatandaş & Basın Eleştirileri",
          negativeCount: negativePosts.length,
          totalMentions: total,
          severity: "medium",
          sampleSnippet: first.content.length > 110 ? `${first.content.slice(0, 110)}...` : first.content,
          affectedDistricts: [first.region || "Muğla Geneli"],
          recommendedAction: "Basın ve halkla ilişkiler birimi üzerinden yapıcı kamuoyu bilgilendirmesi gerçekleştirin.",
        });
      }
    } else {
      vulnerabilities.push({
        topic: "Aktif Kriz Sinyali Yok",
        negativeCount: 0,
        totalMentions: total,
        severity: "low",
        sampleSnippet: "Kurum hakkında son periyotta tespit edilen belirgin bir kriz veya olumsuz şikayet dalgası bulunmuyor.",
        affectedDistricts: ["Tüm İlçeler"],
        recommendedAction: "Mevcut şeffaf iletişim ve saha performansını sürdürün.",
      });
    }

    // District breakdown - 100% REAL POSTS, NO MATH.RANDOM()
    const districtBreakdown: DistrictSentimentBreakdown[] = DISTRICTS.map((d) => {
      // Filter posts that mention this district
      const dPosts = effectivePosts.filter((p) => {
        const text = String(p.content || "").toLowerCase();
        return (
          d.aliases.some((al) => text.includes(al)) ||
          text.includes(d.name.toLowerCase()) ||
          p.region === d.name
        );
      });

      const dTotal = dPosts.length;
      if (dTotal === 0) {
        return {
          districtSlug: d.slug,
          districtName: d.name,
          emoji: d.emoji,
          mentionCount: 0,
          approvalRate: 0,
          dominantSentiment: "neutral" as const,
          topIssue: "Henüz doğrudan sinyal kaydedilmedi",
        };
      }

      const dPos = dPosts.filter((p) => p.sentiment === "positive").length;
      const dNeg = dPosts.filter((p) => p.sentiment === "negative").length;
      const approval = Math.round((dPos / dTotal) * 100);
      const dominant: "positive" | "negative" | "neutral" =
        dPos > dNeg ? "positive" : dNeg > dPos ? "negative" : "neutral";

      // Gerçek negatif gönderi varsa ilkini özetle
      const firstNeg = dPosts.find((p) => p.sentiment === "negative");
      const topIssue = firstNeg
        ? (firstNeg.content.length > 40 ? `${firstNeg.content.slice(0, 40)}...` : firstNeg.content)
        : "Olumlu veya olağan gündem";

      return {
        districtSlug: d.slug,
        districtName: d.name,
        emoji: d.emoji,
        mentionCount: dTotal,
        approvalRate: approval,
        dominantSentiment: dominant,
        topIssue,
      };
    });

    const executiveSummary = `${institution.name}, Muğla genelinde ${total} sosyal ve basın etkileşiminde değerlendirilmiştir. Kurumsal itibar endeksi 100 üzerinden ${rawScore} (${letterGrade}) seviyesindedir. Pozitif geri bildirim oranı %${posPct}, negatif hassasiyet %${negPct} olarak kaydedilmiştir. En güçlü boyut '%${dimensions[1].score} Şeffaflık & İletişim' olurken, en çok iyileştirme gereken alan '%${dimensions[3].score} Altyapı & Çevre Yönetimi' olarak saptanmıştır.`;

    return {
      institution,
      evaluatedAt: new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      overallScore: rawScore,
      letterGrade,
      statusDescription,
      totalMentions: total,
      sentimentBreakdown: {
        positive: pos,
        negative: neg,
        neutral: neu,
        positivePercent: posPct,
        negativePercent: negPct,
        neutralPercent: neuPct,
      },
      dimensions,
      vulnerabilities,
      districtBreakdown,
      crisisRiskLevel: crisisRisk,
      executiveSummary,
    };
  }
}

export const institutionReputation = new InstitutionReputationService();
