// Reading CSV files: the same reader as the calendar import (lib/events.ts):
// quoted values, "" inside quotes, commas and line breaks inside quotes,
// \n or \r\n line ends, and a UTF-8 BOM at the start. Values are always text.
// Unlike the calendar reader, the separator is fixed (a comma by default), so a
// ";" inside an unquoted value never moves the columns, and an unclosed quote is
// reported instead of swallowing the rest of the file.

/** records[i] started on line lines[i] of the file (1 = the header), for messages. */
export type CsvResult = { records: string[][]; lines: number[]; error?: string };

export function readCsv(text: string, separator = ","): CsvResult {
  const src = text.replace(/^\uFEFF/, "");
  const out: string[][] = [];
  const starts: number[] = [];
  let row: string[] = [], field = "", q = false, line = 1, quoteLine = 0, rowLine = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else { if (c === "\n") line++; field += c; }
    } else if (c === '"') { q = true; quoteLine = line; }
    else if (c === separator) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      line++;
      row.push(field); out.push(row); starts.push(rowLine); row = []; field = ""; rowLine = line;
    } else field += c;
  }
  if (q) return { records: [], lines: [], error: `A quote opened on line ${quoteLine} is never closed. Save the file again as CSV from FACTS or Excel.` };
  if (field || row.length) { row.push(field); out.push(row); starts.push(rowLine); }
  const keep = out.map((r, i) => [r, starts[i]] as const).filter(([r]) => r.some((f) => f.trim()));
  return { records: keep.map(([r]) => r), lines: keep.map(([, l]) => l) };
}

/** Header names compared without case, extra spaces or quotes. */
export const headerKey = (h: string) => h.trim().replace(/\s+/g, " ").toLowerCase();
