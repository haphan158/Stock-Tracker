/**
 * Minimal CSV parse/format utilities. We roll our own because:
 *   - the shape is fixed (small, well-defined columns)
 *   - it keeps the dependency footprint stable
 *   - we need to round-trip strings containing commas, quotes, and newlines,
 *     which is the only tricky case full CSV parsers exist to handle.
 */

export interface CsvRow {
  [column: string]: string;
}

export function escapeCsvValue(value: string): string {
  if (value === '' || value === null || value === undefined) return '';
  const needsQuoting = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export function formatCsv(rows: CsvRow[], columns: string[]): string {
  const lines: string[] = [];
  lines.push(columns.map(escapeCsvValue).join(','));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvValue(row[c] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * Parse CSV text into an array of row objects keyed by header. Handles quoted
 * values containing commas, escaped quotes (""), and CR/LF line endings.
 */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/\uFEFF/g, ''); // strip BOM

  while (i < src.length) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (c === '\r' || c === '\n') {
        if (field !== '' || current.length > 0) {
          current.push(field);
          rows.push(current);
        }
        field = '';
        current = [];
        if (c === '\r' && src[i + 1] === '\n') i += 2;
        else i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  if (rows.length === 0) return [];
  const header = (rows[0] ?? []).map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.length === 1 && (row[0] ?? '').trim() === '') continue;
    const obj: CsvRow = {};
    for (let ci = 0; ci < header.length; ci++) {
      obj[header[ci] ?? ''] = (row[ci] ?? '').trim();
    }
    out.push(obj);
  }
  return out;
}
