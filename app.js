(function (root) {
  function parseCsv(text) {
    const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(',').map((cell) => cell.trim());
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    });
  }

  function parseRows(text) {
    const input = String(text || '').trim();
    if (!input) return [];
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === 'object') : [];
    } catch (_) {
      return parseCsv(input);
    }
  }

  function inspect(rows) {
    const findings = [];
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    let missing = 0;
    columns.forEach((column) => {
      const count = rows.filter((row) => row[column] === undefined || row[column] === null || row[column] === '').length;
      missing += count;
      if (count) findings.push({ severity: 'high', issue: `${column} has ${count} missing value${count === 1 ? '' : 's'}`, action: 'Backfill the source or exclude the column from downstream metrics.' });
    });

    ['id', 'user_id', 'customer_id', 'email'].forEach((key) => {
      if (!columns.includes(key)) return;
      const seen = new Map();
      rows.forEach((row, index) => {
        const value = String(row[key] || '').toLowerCase();
        if (!value) return;
        if (seen.has(value)) findings.push({ severity: 'high', issue: `Duplicate ${key} "${value}" on rows ${seen.get(value) + 1} and ${index + 1}`, action: 'Deduplicate before joining or aggregating.' });
        seen.set(value, index);
      });
    });

    if (columns.includes('email')) {
      rows.forEach((row, index) => {
        const email = String(row.email || '');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) findings.push({ severity: 'medium', issue: `Row ${index + 1} has malformed email "${email}"`, action: 'Validate at collection and quarantine invalid contact records.' });
      });
    }

    columns.forEach((column) => {
      const numeric = rows.map((row) => Number(row[column])).filter((value) => Number.isFinite(value));
      if (numeric.length < 4) return;
      const sorted = [...numeric].sort((a, b) => a - b);
      const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
      const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
      const fence = q3 + (q3 - q1) * 1.5;
      const count = numeric.filter((value) => value > fence).length;
      if (count) findings.push({ severity: 'medium', issue: `${column} has ${count} upper outlier${count === 1 ? '' : 's'} above ${fence}`, action: 'Review whether these are true events or ingestion errors before charting.' });
    });

    const totalCells = Math.max(1, rows.length * columns.length);
    const score = Math.max(0, Math.round(100 - (missing / totalCells) * 100 - findings.length * 3));
    return { rowCount: rows.length, columnCount: columns.length, score, findings };
  }

  function render(result) {
    const output = document.querySelector('#results');
    if (!output) return;
    if (!result.rowCount) {
      output.innerHTML = '<p class="empty-state">Paste JSON array or CSV rows to inspect data quality.</p>';
      return;
    }
    const items = result.findings.length
      ? result.findings.map((finding) => `<li><strong>${finding.severity.toUpperCase()}:</strong> ${finding.issue}<br><span>${finding.action}</span></li>`).join('')
      : '<li>No blocking quality issues found. Keep source validation in place.</li>';
    output.innerHTML = `<article><div class="score-row"><h4>Data quality score</h4><span class="score">${result.score}/100</span></div><p>${result.rowCount} rows x ${result.columnCount} columns inspected.</p><ul>${items}</ul></article>`;
  }

  function boot() {
    const input = document.querySelector('#dataInput');
    const button = document.querySelector('#inspectButton');
    if (!input || !button) return;
    button.addEventListener('click', () => render(inspect(parseRows(input.value))));
  }

  const api = { inspect, parseRows, parseCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) root.DatawiseQualityLens = api;
  if (root.document) root.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
