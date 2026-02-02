// backend/src/utils/delimitedParser.js
// Simple delimited (CSV/TXT) parser with basic quoted-field support.

function detectSeparator(headerLine) {
  const candidates = [',', ';', '\t', '|'];
  let best = { sep: ',', count: 0 };
  for (const sep of candidates) {
    const count = (headerLine.split(sep).length - 1);
    if (count > best.count) best = { sep, count };
  }
  if (best.count === 0) return null;
  return best.sep;
}

function splitRow(line, sep) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // handle escaped quotes ""
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .replace(/^\uFEFF/, '') // BOM
    .toLowerCase();
}

function parseDelimitedText(content, { separator: forcedSep } = {}) {
  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'Archivo vacío o inválido' };
  }

  // normalize new lines
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) return { error: 'Archivo vacío' };

  const headerLine = lines[0];
  const separator = forcedSep || detectSeparator(headerLine);
  if (!separator) {
    return { error: 'No se pudo detectar el separador. Usa , ; TAB o |' };
  }

  const headers = splitRow(headerLine, separator).map(normalizeHeader);
  if (!headers.length || headers.some((h) => !h)) {
    return { error: 'Header inválido. Verifica que el archivo tenga encabezados.' };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i], separator);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cols[j] ?? '').trim();
    }
    rows.push({ rowNumber: i + 1, raw: row });
  }

  return { separator, headers, rows };
}

module.exports = {
  parseDelimitedText,
  detectSeparator,
};
