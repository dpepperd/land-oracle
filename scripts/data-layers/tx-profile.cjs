// Profile a TxGIO StratMap county shapefile (.dbf): field list, fill rate per field, sample values. Read-only, streams the file.
// Usage: node scripts/data-layers/tx-profile.cjs <path-to.dbf> [maxRows]
const shapefile = require('shapefile');
(async () => {
  const file = process.argv[2]; const max = Number(process.argv[3] || 0);
  const src = await shapefile.openDbf(file, { encoding: 'utf-8' });
  const fill = {}, sample = {}; let n = 0;
  for (;;) {
    const r = await src.read(); if (r.done) break;
    n++;
    for (const [k, v] of Object.entries(r.value)) {
      const s = v === null || v === undefined ? '' : String(v).trim();
      fill[k] = (fill[k] || 0) + (s !== '' && s !== '0' ? 1 : 0);
      if (s !== '' && (!sample[k] || sample[k].length < 3) && n % 997 === 1) (sample[k] = sample[k] || []).push(s.slice(0, 40));
    }
    if (max && n >= max) break;
  }
  console.log(process.argv[2].split(/[\/]/).pop(), 'rows', n); for (const k of Object.keys(fill)) console.log('  ' + k.padEnd(12) + String((100 * fill[k] / n).toFixed(1)).padStart(6) + '%  ' + (sample[k] || []).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
