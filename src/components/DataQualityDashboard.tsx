import { useEffect, useState } from "react";
import { dataQualityTracker } from "@/lib/data-quality";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Clock, Zap, ChartBar as BarChart3 } from "lucide-react";

interface QualityMetric {
  category: string;
  lastUpdate: number;
  age: number;
  isFresh: boolean;
  hasRealSource: boolean;
  validationStatus: "valid" | "invalid" | "partial" | "unknown";
  source: string;
  lastError?: string;
}

export const DataQualityDashboard = () => {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    dataQualityTracker.loadPersistedMetrics();
    updateMetrics();

    const interval = setInterval(updateMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateMetrics = () => {
    const allMetrics = dataQualityTracker.getAllMetrics().map((m) => ({
      category: m.category,
      lastUpdate: m.timestamp,
      age: Math.round((Date.now() - m.timestamp) / (1000 * 60)),
      isFresh: (Date.now() - m.timestamp) / (1000 * 60) < 120,
      hasRealSource: m.has_real_source,
      validationStatus: m.validation_status,
      source: m.source,
      lastError: m.last_error,
    }));

    setMetrics(allMetrics);
    setSummary(dataQualityTracker.getHealthSummary());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "invalid":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string, isFresh: boolean) => {
    if (!isFresh) {
      return <Badge variant="outline" className="text-xs bg-red-50 border-red-200">ESKİ VERİ</Badge>;
    }
    switch (status) {
      case "valid":
        return <Badge className="text-xs bg-green-600">DOĞRU</Badge>;
      case "partial":
        return <Badge variant="outline" className="text-xs border-yellow-500">KISMÎ</Badge>;
      case "invalid":
        return <Badge variant="destructive" className="text-xs">HATA</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">BİLİNMEYEN</Badge>;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="fixed top-20 right-6 z-40 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110">
          <BarChart3 className="w-5 h-5" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-96 max-h-screen overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Veri Kalitesi Kontrol Paneli
          </SheetTitle>
        </SheetHeader>

        {summary && (
          <div className="grid grid-cols-2 gap-2 py-3 px-3 bg-secondary/30 rounded-lg text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Toplam Kaynak</p>
              <p className="font-bold">{summary.total_sources}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sağlıklı</p>
              <p className="font-bold text-green-600">{summary.healthy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ücretsiz</p>
              <p className="font-bold text-blue-600">{summary.free_sources}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ortalama Yaş</p>
              <p className="font-bold">{summary.avg_age_minutes} dk</p>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6 py-4">
          <div className="space-y-3">
            {metrics.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Henüz veri kalitesi metriği yok. Verileri yüklenmeyi bekle.
              </div>
            ) : (
              metrics.map((metric) => (
                <div key={metric.category} className="border rounded-lg p-3 space-y-2 bg-secondary/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getStatusIcon(metric.validationStatus)}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold capitalize text-foreground">
                          {metric.category.replace(/_/g, " ")}
                        </h4>
                        <p className="text-[10px] text-muted-foreground">{metric.source}</p>
                      </div>
                    </div>
                    {getStatusBadge(metric.validationStatus, metric.isFresh)}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{metric.age === 0 ? "Hemen şimdi" : `${metric.age} dakika önce`}</span>
                  </div>

                  {metric.hasRealSource ? (
                    <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                      <Zap className="w-3 h-3" />
                      Ücretsiz gerçek kaynak
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      <AlertCircle className="w-3 h-3" />
                      Ücretli veya tahmini
                    </div>
                  )}

                  {metric.lastError && (
                    <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">
                      Hata: {metric.lastError}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-3 text-[10px] text-muted-foreground text-center">
          <p>Veriler 30 saniyede bir güncellenir</p>
          <p className="mt-1 text-[9px]">Intelligence Hub © 2025 Muğla Monitör</p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
