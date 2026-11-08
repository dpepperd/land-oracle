const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('audit_report.json', 'utf8'));
  let issues = data.filter(d => d.delta > 0);
  console.log('Total counties with deltas: ' + issues.length);
  
  // Sort by percentage gap
  issues.sort((a,b) => (b.delta/b.shpCount) - (a.delta/a.shpCount));

  issues.forEach(d => {
    let pct = ((d.delta / d.shpCount) * 100).toFixed(1);
    console.log(`${d.county.padEnd(20)} | Gap: ${d.delta.toString().padEnd(6)} | SHP: ${d.shpCount.toString().padEnd(7)} | ${pct}%`);
  });
} catch(e) {
  console.error(e);
}
