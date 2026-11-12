// Download and load every TxGIO county (one at a time) into the staging table, using load-tx-parcels.cjs.
// Usage: node scripts/data-layers/tx-load-all.cjs <table> <workdir> <keys.txt> [skipFips5,skipFips5...]
//   keys.txt = S3 keys, one per line (list of https://tnris-data-warehouse.s3.amazonaws.com/?prefix=LCD/collection/stratmap-2025-land-parcels/items/shp/)
// Resumable: <workdir>/done.txt lists finished counties and they are skipped on the next run. Failures go to <workdir>/failed.txt and the run continues.
// Each county's files are deleted after loading, so the disk only ever holds one county.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const [table, work, keysFile, skipArg] = process.argv.slice(2);
if (!table || !work || !keysFile) { console.error('usage: <table> <workdir> <keys.txt> [skipFips5,...]'); process.exit(1); }
fs.mkdirSync(work, { recursive: true });
const doneFile = path.join(work, 'done.txt'), failFile = path.join(work, 'failed.txt');
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split(/\r?\n/).filter(Boolean) : []);
(skipArg || '').split(',').filter(Boolean).forEach((f) => done.add(f));
const keys = fs.readFileSync(keysFile, 'utf8').split(/\r?\n/).filter((k) => /_(\d{5})_shp\.zip$/.test(k));
const BASE = 'https://tnris-data-warehouse.s3.amazonaws.com/';
const TAR = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar'; // Windows bsdtar reads zip
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let ok = 0, bad = 0; const t0 = Date.now();
for (const key of keys) {
  const fips5 = /_(\d{5})_shp\.zip$/.exec(key)[1];
  if (done.has(fips5)) continue;
  const dir = path.join(work, fips5); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'c.zip');
  const fail = (why) => { bad++; fs.appendFileSync(failFile, `${fips5} ${why}\n`); console.log(`FAILED ${fips5}: ${why}`); fs.rmSync(dir, { recursive: true, force: true }); };
  let got = false;
  for (let a = 1; a <= 3 && !got; a++) { const r = spawnSync('curl', ['-sfL', '--max-time', '1800', '-o', zip, BASE + key], { stdio: 'inherit' }); got = r.status === 0 && fs.existsSync(zip) && fs.statSync(zip).size > 1000; }
  if (!got) { fail('download'); continue; }
  const x = spawnSync(TAR, ['-xf', zip, '-C', dir], { stdio: 'inherit' });
  if (x.status !== 0) { fail('unzip'); continue; }
  fs.rmSync(zip);
  const shps = walk(dir).filter((f) => /\.shp$/i.test(f) && fs.existsSync(f.replace(/\.shp$/i, '.dbf'))).map((f) => f.replace(/\\/g, '/'));
  if (!shps.length) { fail('no shp'); continue; }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'load-tx-parcels.cjs'), table, fips5.slice(2), shps.join(',')], { stdio: 'inherit' });
  if (r.status !== 0) { fail('load'); continue; }
  fs.appendFileSync(doneFile, fips5 + '\n'); ok++;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`== ${fips5} done (${ok} ok, ${bad} failed, ${Math.round((Date.now() - t0) / 60000)} min)`);
}
console.log(`ALL DONE: ${ok} loaded this run, ${bad} failed, ${done.size} counties complete in total`);
