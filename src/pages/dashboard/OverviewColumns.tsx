// src/pages/dashboard/OverviewColumns.tsx
// "Genel Bakış" 3 sütunlu sürükle-bırak göstergesi. Index.tsx'ten ayrıştırıldı; davranış birebir korunur.

import type { DragEvent } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { SmartCard } from "@/components/intelligence/SmartCard";
import { PANEL_REGISTRY, type ColumnLayout } from "./overviewLayout";

type ColKey = "col1" | "col2" | "col3";

interface OverviewColumnsProps {
  columns: ColumnLayout;
  isEditMode: boolean;
  draggedWidget: { fromCol: ColKey; fromIdx: number; widgetId: string } | null;
  dragOverTarget: { colKey: ColKey; targetIdx: number } | null;
  onWidgetDragStart: (e: DragEvent, fromCol: ColKey, fromIdx: number, widgetId: string) => void;
  onWidgetDragOver: (e: DragEvent, colKey: ColKey, targetIdx: number) => void;
  onWidgetDrop: (e: DragEvent, targetCol: ColKey, targetIdx?: number) => void;
  onShiftCol: (fromCol: ColKey, direction: -1 | 1, widgetId: string) => void;
  onMoveWithinCol: (colKey: ColKey, index: number, delta: number) => void;
  onMoveToCol: (fromCol: ColKey, toCol: ColKey, widgetId: string) => void;
}

export const OverviewColumns = ({
  columns,
  isEditMode,
  draggedWidget,
  dragOverTarget,
  onWidgetDragStart,
  onWidgetDragOver,
  onWidgetDrop,
  onShiftCol,
  onMoveWithinCol,
  onMoveToCol,
}: OverviewColumnsProps) => {
  const { t } = useTranslation();

  // Bağımsız Gösterge Kutucuğu Render Fonksiyonu
  const renderWidget = (colKey: ColKey, widgetId: string, idx: number, totalCount: number) => {
    const panelDef = PANEL_REGISTRY[widgetId];
    if (!panelDef) return null;

    const isBeingDragged = draggedWidget?.widgetId === widgetId;
    const isTargetSlot = dragOverTarget?.colKey === colKey && dragOverTarget?.targetIdx === idx;

    return (
      <div key={widgetId} className="flex flex-col">
        {/* Apple Stili Sürükleme Hedefi Çizgisi / Yeri */}
        {isTargetSlot && !isBeingDragged && (
          <div className="h-10 border-2 border-dashed border-cyan-400/90 bg-cyan-500/15 rounded-lg flex items-center justify-center text-[10px] font-mono text-cyan-300 font-bold animate-pulse mb-2 shadow-sm">
            + {t("Buraya Yerleştir")} (#{idx + 1})
          </div>
        )}

        <div
          onDragOver={(e) => onWidgetDragOver(e, colKey, idx)}
          onDrop={(e) => onWidgetDrop(e, colKey, idx)}
          className={`group relative rounded-lg flex flex-col justify-between transition-all duration-200 ${
            isBeingDragged
              ? "opacity-35 scale-95 border border-dashed border-primary"
              : isEditMode
              ? "border border-primary/50 shadow-md ring-1 ring-primary/30 bg-card/85"
              : ""
          }`}
        >
          {/* Sürükle-bırak kontrol çubuğu yalnızca düzenleme modunda görünür (çift başlık gürültüsünü önler) */}
          {isEditMode && (
            <div
              draggable={true}
              onDragStart={(e) => onWidgetDragStart(e, colKey, idx, widgetId)}
              className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/60 hover:bg-secondary/90 border-b border-border/40 rounded-t-lg text-[10px] font-mono text-muted-foreground select-none cursor-grab active:cursor-grabbing transition-colors"
              title={t("Sürüklemek için bu başlıktan tutun", "Sürüklemek için bu başlıktan tutun")}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                <span className="cursor-grab active:cursor-grabbing text-xs text-primary/80 hover:text-primary">⋮⋮</span>
                <span className="font-semibold">{t(panelDef.title)}</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onShiftCol(colKey, -1, widgetId)}
                  disabled={colKey === "col1"}
                  aria-label={t("Sola / Önceki sütuna taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Sola / Önceki sütuna taşı")}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => onMoveWithinCol(colKey, idx, -1)}
                  disabled={idx === 0}
                  aria-label={t("Yukarı taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Yukarı taşı")}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onMoveWithinCol(colKey, idx, 1)}
                  disabled={idx === totalCount - 1}
                  aria-label={t("Aşağı taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Aşağı taşı")}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onShiftCol(colKey, 1, widgetId)}
                  disabled={colKey === "col3"}
                  aria-label={t("Sağa / Sonraki sütuna taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Sağa / Sonraki sütuna taşı")}
                >
                  ▶
                </button>
                <select
                  value={colKey}
                  aria-label={t("Doğrudan sütun seç")}
                  onChange={(e) => onMoveToCol(colKey, e.target.value as ColKey, widgetId)}
                  className="bg-background/90 border border-border/70 rounded px-1 py-0.5 text-[9px] text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  title={t("Doğrudan sütun seç")}
                >
                  <option value="col1">S.1</option>
                  <option value="col2">S.2</option>
                  <option value="col3">S.3</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex-1">
            <SmartCard category={panelDef.category as any}>
              {panelDef.component}
            </SmartCard>
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (colKey: ColKey) => (
    <div
      className="flex flex-col space-y-5 min-h-[240px]"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => onWidgetDrop(e, colKey, columns[colKey].length)}
    >
      {columns[colKey].map((widgetId, idx) =>
        renderWidget(colKey, widgetId, idx, columns[colKey].length)
      )}

      {columns[colKey].length === 0 && (
        <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground">
          {t("Göstergeyi buraya sürükleyin")}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
      {renderColumn("col1")}
      {renderColumn("col2")}
      {renderColumn("col3")}
    </div>
  );
};
