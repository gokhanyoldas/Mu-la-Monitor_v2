// src/pages/dashboard/useOverviewLayout.ts
// "Genel Bakış" sekmesinin düzen durumu ve sürükle-bırak/tuş hareketi mantığı.
// Index.tsx'ten ayrıştırıldı; davranış birebir korunur.

import { useState, type DragEvent } from "react";
import {
  COLUMNS_STORAGE_KEY,
  DEFAULT_COLUMNS,
  DEFAULT_METRIC_ORDER,
  METRIC_ORDER_STORAGE_KEY,
  sanitizeColumns,
  type ColumnLayout,
} from "./overviewLayout";

type ColKey = "col1" | "col2" | "col3";

export function useOverviewLayout() {
  // Apple Stili Düzenleme Modu (Genel Bakış)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Genel Bakış için 3 ana yönetici özeti kartı yerleşimi
  const [columns, setColumns] = useState<ColumnLayout>(() => {
    try {
      localStorage.removeItem("mugla_dashboard_columns_v7");
      const savedV8 = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (savedV8) return sanitizeColumns(JSON.parse(savedV8));
    } catch {}
    return DEFAULT_COLUMNS;
  });

  // Üst Sayaç Göstergeleri Sıralaması
  const [metricOrder, setMetricOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(METRIC_ORDER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_METRIC_ORDER;
  });

  const [draggedWidget, setDraggedWidget] = useState<{
    fromCol: ColKey;
    fromIdx: number;
    widgetId: string;
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{
    colKey: ColKey;
    targetIdx: number;
  } | null>(null);

  const [draggedMetricIndex, setDraggedMetricIndex] = useState<number | null>(null);

  const saveColumns = (newCols: ColumnLayout) => {
    setColumns(newCols);
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(newCols));
    } catch {}
  };

  const saveMetricOrder = (newOrder: string[]) => {
    setMetricOrder(newOrder);
    try {
      localStorage.setItem(METRIC_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    } catch {}
  };

  // Sütun içinde yukarı / aşağı taşıma
  const moveWithinCol = (colKey: ColKey, index: number, delta: number) => {
    const list = [...columns[colKey]];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    saveColumns({ ...columns, [colKey]: list });
  };

  // Farklı bir sütuna taşıma
  const moveToCol = (fromCol: ColKey, toCol: ColKey, widgetId: string) => {
    if (fromCol === toCol) return;
    const fromList = columns[fromCol].filter(id => id !== widgetId);
    const toList = [...columns[toCol], widgetId];
    saveColumns({
      ...columns,
      [fromCol]: fromList,
      [toCol]: toList,
    });
  };

  // Sütunlar arası tek tıkla kaydırma (Mobil / Dokunmatik dostu)
  const shiftCol = (fromCol: ColKey, direction: -1 | 1, widgetId: string) => {
    const colOrder: ColKey[] = ["col1", "col2", "col3"];
    const curIdx = colOrder.indexOf(fromCol);
    const targetIdx = curIdx + direction;
    if (targetIdx >= 0 && targetIdx < colOrder.length) {
      moveToCol(fromCol, colOrder[targetIdx], widgetId);
    }
  };

  // Genel Bakış düzenini varsayılana sıfırlama
  const resetToDefaultColumns = () => {
    saveColumns(DEFAULT_COLUMNS);
    saveMetricOrder(DEFAULT_METRIC_ORDER);
    setDragOverTarget(null);
    setDraggedWidget(null);
  };

  // Sürükle ve Bırak Olayları (Apple Stili Görsel Geri Bildirim)
  const handleWidgetDragStart = (
    e: DragEvent,
    fromCol: ColKey,
    fromIdx: number,
    widgetId: string
  ) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "widget", fromCol, fromIdx, widgetId }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedWidget({ fromCol, fromIdx, widgetId });
  };

  const handleWidgetDragOver = (e: DragEvent, colKey: ColKey, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTarget?.colKey !== colKey || dragOverTarget?.targetIdx !== targetIdx) {
      setDragOverTarget({ colKey, targetIdx });
    }
  };

  const handleWidgetDrop = (e: DragEvent, targetCol: ColKey, targetIdx?: number) => {
    e.preventDefault();
    e.stopPropagation();

    let dragData = draggedWidget;
    if (!dragData) {
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.type === "widget") dragData = parsed;
        }
      } catch {}
    }

    setDragOverTarget(null);
    if (!dragData) return;
    const { fromCol, fromIdx, widgetId } = dragData;

    if (fromCol === targetCol) {
      if (targetIdx === undefined || targetIdx === fromIdx) {
        setDraggedWidget(null);
        return;
      }
      const list = [...columns[fromCol]];
      const [item] = list.splice(fromIdx, 1);
      list.splice(targetIdx, 0, item);
      saveColumns({ ...columns, [fromCol]: list });
    } else {
      const fromList = columns[fromCol].filter((_, i) => i !== fromIdx);
      const toList = [...columns[targetCol]];
      const insertAt = targetIdx !== undefined ? targetIdx : toList.length;
      toList.splice(insertAt, 0, widgetId);
      saveColumns({
        ...columns,
        [fromCol]: fromList,
        [targetCol]: toList,
      });
    }

    setDraggedWidget(null);
  };

  // Üst gösterge sürükleme fonksiyonları
  const handleMetricDragStart = (e: DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "metric", index }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedMetricIndex(index);
  };

  const handleMetricDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    let fromIndex = draggedMetricIndex;
    if (fromIndex === null) {
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.type === "metric") fromIndex = parsed.index;
        }
      } catch {}
    }

    if (fromIndex === null || fromIndex === targetIndex) return;

    const newOrder = [...metricOrder];
    const [moved] = newOrder.splice(fromIndex!, 1);
    newOrder.splice(targetIndex, 0, moved);
    saveMetricOrder(newOrder);
    setDraggedMetricIndex(null);
  };

  return {
    isEditMode,
    setIsEditMode,
    columns,
    metricOrder,
    draggedWidget,
    dragOverTarget,
    saveColumns,
    saveMetricOrder,
    moveWithinCol,
    moveToCol,
    shiftCol,
    resetToDefaultColumns,
    handleWidgetDragStart,
    handleWidgetDragOver,
    handleWidgetDrop,
    handleMetricDragStart,
    handleMetricDrop,
  };
}
