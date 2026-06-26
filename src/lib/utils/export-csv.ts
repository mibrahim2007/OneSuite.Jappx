export type CsvHeader = { key: string; label: string };

function escapeCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  headers: CsvHeader[]
): void {
  const headerLine = headers.map((h) => escapeCell(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h.key])).join(",")
  );
  const csv = [headerLine, ...dataLines].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
