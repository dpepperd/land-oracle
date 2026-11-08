const { execSync } = require('child_process');
const counties = ['Hamilton', 'Madison', 'Gilchrist', 'Liberty', 'Jackson', 'Jefferson', 'Bay', 'Walton', 'Union'];

for (const c of counties) {
  console.log(`Running ingestion for ${c}...`);
  try {
    execSync(`node scripts/load-county.js "${c}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed on ${c}:`, e.message);
  }
}
console.log('Done mapping all remaining deficient counties.');
