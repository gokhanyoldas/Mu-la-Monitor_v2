// src/pages/Index.tsx
// Komuta Merkezi kompozisyon kökü. Düzen/panel tanımları ve gösterge bileşenleri
// src/pages/dashboard/* altına ayrıştırıldı; davranış ve dışa açık API birebir korunur.

import { useTranslation } from "@/hooks/useTranslation";
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/DashboardHeader";
import { useMonitorUrlState } from "@/hooks/useMonitorUrlState";
import { SmartCard } from "@/components/intelligence/SmartCard";
// M10: Deprem Erken Uyarı Banner
import { EarthquakeAlertBanner } from "@/components/EarthquakeAlertBanner";
// Şehir Özeti: güncel şehir durumunu tek kartta toplar
import { AISummaryCard } from "@/components/AISummaryCard";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";
import { ProtocolSection } from "@/components/dashboard/sections/ProtocolSection";

import { useOverviewLayout } from "./dashboard/useOverviewLayout";
import { OverviewMetricBar } from "./dashboard/OverviewMetricBar";
import { OverviewColumns } from "./dashboard/OverviewColumns";
import { DashboardFooter } from "./dashboard/DashboardFooter";
import { getTwoColumnTabContent } from "./dashboard/tabContent";
import { DEFAULT_COLUMNS, type ColumnLayout } from "./dashboard/overviewLayout";

// Dışa açık API (App.tsx lazy import + sprint2 regresyon testi) korunur.
export { DEFAULT_COLUMNS };
export type { ColumnLayout };

const Index = () => {
  const { t } = useTranslation();
  const {
    activeTab,
    hubInitialView,
    activeDistrict,
    setActiveTab,
    setActiveDistrict,
  } = useMonitorUrlState();

  const {
    isEditMode,
    setIsEditMode,
    columns,
    metricOrder,
    draggedWidget,
    dragOverTarget,
    moveWithinCol,
    moveToCol,
    shiftCol,
    resetToDefaultColumns,
    handleWidgetDragStart,
    handleWidgetDragOver,
    handleWidgetDrop,
    handleMetricDragStart,
    handleMetricDrop,
  } = useOverviewLayout();

  const isGenel = activeTab === "genel";

  return (
    <div className="min-h-screen bg-background scanline">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeDistrict={activeDistrict}
        onDistrictChange={setActiveDistrict}
      />

      {/* M10: Earthquake banner — always visible above main content */}
      <EarthquakeAlertBanner />

      <main className="p-4 sm:p-5 max-w-[1680px] mx-auto">
        {/* Sade Üst Özet Çubuğu — her kutu doğrudan ilgili uzmanlık sekmesine yönlendirir */}
        <OverviewMetricBar
          metricOrder={metricOrder}
          isEditMode={isEditMode}
          onMetricDragStart={handleMetricDragStart}
          onMetricDrop={handleMetricDrop}
          onSelectTab={setActiveTab}
        />

        <div className="space-y-5">
          {/* Genel Bakış: Sade Şehir Özeti + 3 Sütunlu Ferah Özet Kartları */}
          {isGenel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("Genel Bakış")}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(v => !v)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      isEditMode
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {isEditMode ? t("Bitti (Koru)") : t("Düzeni Özelleştir")}
                  </button>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={resetToDefaultColumns}
                      className="px-2.5 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border/60"
                    >
                      {t("Düzeni Sıfırla")}
                    </button>
                  )}
                </div>
              </div>
              <AISummaryCard type="pulse" />
            </div>
          )}

          {isGenel ? (
            <OverviewColumns
              columns={columns}
              isEditMode={isEditMode}
              draggedWidget={draggedWidget}
              dragOverTarget={dragOverTarget}
              onWidgetDragStart={handleWidgetDragStart}
              onWidgetDragOver={handleWidgetDragOver}
              onWidgetDrop={handleWidgetDrop}
              onShiftCol={shiftCol}
              onMoveWithinCol={moveWithinCol}
              onMoveToCol={moveToCol}
            />
          ) : activeTab === "diyagram" ? (
            <div className="space-y-5">
              <InvestigationHub initialView={hubInitialView} />
            </div>
          ) : activeTab === "protokol" ? (
            <div className="space-y-5">
              <SmartCard category="protocol">
                <ProtocolSection />
              </SmartCard>
            </div>
          ) : (
            (() => {
              const content = getTwoColumnTabContent(activeTab as Exclude<DashboardTab, "genel" | "protokol" | "diyagram">);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  <div className="flex flex-col space-y-5">
                    {content.col1.map((node, i) => (
                      <div key={i}>{node}</div>
                    ))}
                  </div>
                  <div className="flex flex-col space-y-5">
                    {content.col2.map((node, i) => (
                      <div key={i}>{node}</div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Sade Footer + Tek Göze Batmayan Geliştirici Sistem Durumu Bağlantısı */}
        <DashboardFooter />
      </main>
    </div>
  );
};

export default Index;
