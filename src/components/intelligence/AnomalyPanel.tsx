import { useEffect, useState } from "react";
import { intelligenceHub, type AnomalyAlert } from "@/lib/intelligence-hub";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, Info, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export const AnomalyPanel = () => {
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadStoredAnomalies = () => {
      try {
        const stored = localStorage.getItem("ih_anomalies");
        if (stored) {
          const alerts = JSON.parse(stored);
          setAnomalies(alerts);
        }
      } catch (err) {
        console.error("Failed to load anomalies:", err);
      }
    };

    loadStoredAnomalies();

    const unsubscribe = intelligenceHub.subscribeToAnomalies((alert) => {
      setAnomalies((prev) => [alert, ...prev.slice(0, 49)]);

      if (alert.severity === "critical") {
        setIsOpen(true);
      }
    });

    return unsubscribe;
  }, []);

  const visibleAnomalies = anomalies.filter(a => !dismissedIds.has(a.id));
  const criticalCount = visibleAnomalies.filter(a => a.severity === "critical").length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-xs">KRİTİK</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">UYARI</Badge>;
      case "info":
        return <Badge variant="secondary" className="text-xs">BİLGİ</Badge>;
      default:
        return null;
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleClearAll = () => {
    intelligenceHub.clearAnomalies();
    setAnomalies([]);
    setDismissedIds(new Set());
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 group">
          <Bell className="w-6 h-6" />
          {criticalCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-pulse">
              {criticalCount}
            </div>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-96 max-h-screen overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Kritik İstihbarat Uyarıları
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-2">
            {visibleAnomalies.length} aktif uyarı
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {visibleAnomalies.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aktif uyarı yok</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {visibleAnomalies.map((alert) => (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-3 space-y-2 ${
                    alert.severity === "critical"
                      ? "bg-red-50 border-red-200"
                      : alert.severity === "warning"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
                        {getSeverityBadge(alert.severity)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(alert.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-foreground/80">{alert.description}</p>

                  <p className="text-[10px] text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString("tr-TR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {visibleAnomalies.length > 0 && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="w-full text-xs"
            >
              Tümünü Temizle
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
