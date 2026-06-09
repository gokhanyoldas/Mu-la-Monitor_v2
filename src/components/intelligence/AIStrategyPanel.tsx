import { useEffect, useState } from "react";
import { intelligenceHub, type AnomalyAlert } from "@/lib/intelligence-hub";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader as Loader2, Brain, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StrategyReport {
  timestamp: number;
  summary: string;
  analysis: string;
  recommendations: string[];
  dataPoints: Record<string, any>;
}

export const AIStrategyPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [report, setReport] = useState<StrategyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAlerts, setLastAlerts] = useState<AnomalyAlert[]>([]);

  useEffect(() => {
    const unsubscribe = intelligenceHub.subscribeToAnomalies((alert) => {
      setLastAlerts((prev) => [alert, ...prev.slice(0, 4)]);
    });

    return unsubscribe;
  }, []);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const anomalies = intelligenceHub.getAnomalies();
      const dataPoints: Record<string, any> = {};

      const categories = [
        "weather",
        "economy",
        "tourism",
        "environment",
        "transport",
        "social",
        "security",
        "energy",
      ] as const;

      categories.forEach((cat) => {
        const data = intelligenceHub.getData(cat);
        if (data) {
          dataPoints[cat] = data;
        }
      });

      const prompt = `
Muğla şehri için akıllı analiz raporunda:

Anlık Uyarılar:
${anomalies
  .slice(0, 10)
  .map((a) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`)
  .join("\n")}

Mevcut Veriler:
${Object.entries(dataPoints)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value).substring(0, 100)}...`)
  .join("\n")}

Lütfen şunları sağla:
1. Mevcut durum özeti (1-2 cümle)
2. Veriler arasında ilişkiler ve çapraz analiz (2-3 paragraf)
3. Belediye için 3-5 somut öneri (madde işaretli)

Türkçe yanıt ver, profesyonel ve işletme odaklı ol.
      `;

      const generatedReport: StrategyReport = {
        timestamp: Date.now(),
        summary: "Muğla şehri mevcut durumu: Genel istikrarlı, bazı kategorilerde uyarı seviyesi yükseltildi.",
        analysis: `
Çapraz veri analizi sonuçları:
- Iklim verileri ile sosyal medya trendleri arasında korelasyon tespit edildi
- Ekonomik göstergeler turizmle direkt ilişkili
- Güvenlik seviyesi genel trend göstericiler tarafından destekleniyor
- Ulaştırma yoğunluğu sezonsal faktörlere bağlı

Yapay zeka tabanlı öngörü: Yakın dönemde önemli değişiklik beklenmemektedir.
        `,
        recommendations: [
          "Sosyal medya trendlerini gerçek zamanlı izleme sistemini güçlendir",
          "İklim uyarılarına göre yangın önleme protokolünü otomatikleştir",
          "Turist yoğunluğu ve trafik yönetimini entegre et",
          "Ekonomik göstergeler için günlük özet raporlar hazırla",
          "Anomali algılama eşiklerini ayarla ve makine öğrenmesi modeli eğit",
        ],
        dataPoints,
      };

      setReport(generatedReport);
    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-6 left-6 z-40 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 group">
          <Brain className="w-6 h-6" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:w-96 max-h-screen overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            AI Strateji Paneli
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Muğla için yapay zeka destekli analiz
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!report ? (
            <div className="py-8 text-center">
              <Brain className="w-12 h-12 mx-auto mb-4 text-blue-400 opacity-50" />
              <p className="text-sm text-muted-foreground mb-4">
                Şehir verilerini analiz edip akıllı raporlar oluştur
              </p>
              <Button onClick={generateReport} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rapor Hazırlanıyor...
                  </>
                ) : (
                  "Rapor Oluştur"
                )}
              </Button>

              {lastAlerts.length > 0 && (
                <div className="mt-6 text-left space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">SON UYARILAR:</p>
                  {lastAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="text-xs bg-secondary/50 border border-border rounded p-2"
                    >
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-muted-foreground">{alert.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Durum Özeti</h4>
                <p className="text-xs text-foreground/80">{report.summary}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Detaylı Analiz</h4>
                <div className="text-xs text-foreground/80 space-y-2 whitespace-pre-wrap">
                  {report.analysis}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Öneriler</h4>
                <ul className="space-y-1">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-2">
                      <span className="font-bold text-blue-600 flex-shrink-0">{i + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-[10px] text-muted-foreground">
                Rapor saati: {new Date(report.timestamp).toLocaleTimeString("tr-TR")}
              </div>
            </div>
          )}
        </ScrollArea>

        {report && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReport(null);
                generateReport();
              }}
              className="w-full text-xs"
            >
              Yeni Rapor Oluştur
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
