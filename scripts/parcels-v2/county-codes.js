// Derives county_codes (co_no, name, fips) and cross-checks against the NAL
// filename prefixes on disk. Names match parcels.county exactly.
// FIPS: 12 + 3-digit county code (odd, alphabetical; Miami-Dade = 086, formerly Dade 025).
// DOR co_no: 11 + alphabetical position (Dade sorted as "Dade"), matches NAL<co_no>F....csv.
const fs = require('fs');
const ordered = ['Alachua','Baker','Bay','Bradford','Brevard','Broward','Calhoun','Charlotte','Citrus','Clay','Collier','Columbia',
 'Miami-Dade', /* sorts as Dade */ 'Desoto','Dixie','Duval','Escambia','Flagler','Franklin','Gadsden','Gilchrist','Glades','Gulf','Hamilton',
 'Hardee','Hendry','Hernando','Highlands','Hillsborough','Holmes','Indian River','Jackson','Jefferson','Lafayette','Lake','Lee','Leon','Levy',
 'Liberty','Madison','Manatee','Marion','Martin','Monroe','Nassau','Okaloosa','Okeechobee','Orange','Osceola','Palm Beach','Pasco','Pinellas',
 'Polk','Putnam','Saint Johns','Saint Lucie','Santa Rosa','Sarasota','Seminole','Sumter','Suwannee','Taylor','Union','Volusia','Wakulla','Walton','Washington'];
const rows = ordered.map((name, i) => {
  const pos = i + 1;
  return { co_no: 10 + pos, name, fips: name === 'Miami-Dade' ? '12086' : '12' + String(2 * pos - 1).padStart(3, '0') };
});
module.exports = { rows };
if (require.main === module) {
  const BASE = 'D:/LandOracle/Florida'; let bad = 0, checked = 0;
  for (const r of rows) {
    const dir = `${BASE}/${r.name}`; if (!fs.existsSync(dir)) { console.log('no dir', r.name); continue; }
    const nal = fs.readdirSync(dir).find((f) => /^NAL\d+/i.test(f));
    if (!nal) { console.log('no NAL file (code taken from DOR ordering):', r.name, r.co_no); continue; }
    checked++; const n = Number(nal.match(/^NAL(\d+)/i)[1]);
    if (n !== r.co_no) { bad++; console.log('MISMATCH', r.name, 'derived', r.co_no, 'file', n); }
  }
  console.log(`rows=${rows.length} checked_against_NAL=${checked} mismatches=${bad}`);
}
