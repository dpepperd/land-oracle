// Generates lib/parcels/states/fl-codes.json (DOR use codes + NAL exemption fields) from the DOR Quick Reference workbook.
// node scripts/ai/gen-fl-codes.js   (needs data/dor/2026/docs/quickref.json from scripts/dor/xlsx-dump.js)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const q = JSON.parse(fs.readFileSync(path.join(root, 'data', 'dor', '2026', 'docs', 'quickref.json'), 'utf8'));
const useCodes = {};
let section = null;
for (const r of q['Use Codes'].slice(1)) {
  if (!r || r[0] == null) continue;
  const code = String(r[0]).trim();
  if (r[1] == null && !/^\d{3}$/.test(code)) { section = code; continue; }
  if (/^\d{3}$/.test(code)) useCodes[code] = { label: String(r[1]).replace(/\s+/g, ' ').trim(), section };
}
const exemptions = [];
for (const r of q['NAL Exemption Codes']) {
  if (!r || !/^EXMPT_\d+$/.test(String(r[2] || '').trim())) continue;
  const desc = String(r[4] || '').replace(/\s+/g, ' ').trim();
  exemptions.push({ field: String(r[2]).trim().toLowerCase(), label: desc.split(/(?<=\.)\s/)[0].slice(0, 110), statute: r[8] == null ? null : String(r[8]) });
}
fs.writeFileSync(path.join(root, 'lib', 'parcels', 'states', 'fl-codes.json'), JSON.stringify({ source: 'FL DOR 2026 User Guide Quick Reference', useCodes, exemptions }, null, 1));
console.log('use codes', Object.keys(useCodes).length, 'exemption fields', exemptions.length);
