// exportReports — PDF/Excel dışa aktarım yardımcıları.
// xlsx ve jspdf ağır bağımlılıklar; ilk yüklemede bundle'ı şişirmemek için
// dinamik import ile sadece kullanıcı dışa aktardığında yüklenir.

export interface ExportRow {
  [key: string]: string | number | null | undefined;
}

export async function exportToExcel(rows: ExportRow[], filename: string, sheetName = "Rapor") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPdf(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string,
  subtitle?: string,
) {
  const [{ default: JsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(sanitizeTr(title), 14, 16);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(sanitizeTr(subtitle), 14, 23);
  }
  const autoTable = (autoTableMod as { default?: (d: unknown, o: unknown) => void }).default;
  autoTable?.(doc, {
    startY: 28,
    head: [columns.map(sanitizeTr)],
    body: rows.map(r => r.map(c => sanitizeTr(String(c ?? "")))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`${filename}.pdf`);
}

// jspdf standart fontları Türkçe glifleri desteklemez; okunabilir transliterasyon
function sanitizeTr(s: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", I: "I",
    İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
  };
  return s.replace(/[çÇğĞıIİöÖşŞüÜ]/g, ch => map[ch] ?? ch);
}
