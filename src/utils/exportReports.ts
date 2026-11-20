// exportReports — PDF/CSV dışa aktarım yardımcıları.
// CSV, Excel tarafından doğrudan açılabilir ve güvenlik açısından xlsx parser'ı çalıştırmaz.

export interface ExportRow {
  [key: string]: string | number | null | undefined;
}

export function exportToCsv(rows: ExportRow[], filename: string) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escapeCell = (value: unknown) => {
    const text = String(value ?? "").replace(/\r?\n/g, " ");
    return /[",;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    columns.map(escapeCell).join(","),
    ...rows.map(row => columns.map(column => escapeCell(row[column])).join(",")),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
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
