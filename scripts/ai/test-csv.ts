// The shared CSV writer: formula protection and unchanged formatting. No database. Usage: npx tsx scripts/ai/test-csv.ts
import { csvCell, toCSV } from '../../lib/csv';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

for (const bad of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '=HYPERLINK("http://x","y")', '\tcmd', '\rcmd']) {
  const out = csvCell(bad);
  check(`text starting a formula is neutralised: ${JSON.stringify(bad)}`, out.replace(/^"/, '').startsWith("'"), JSON.stringify(out));
}
check('normal text is untouched', csvCell('SMITH JOHN') === 'SMITH JOHN', csvCell('SMITH JOHN'));
check('a dash inside text is untouched', csvCell('12 OAK ST - OFF') === '12 OAK ST - OFF', '');
check('a negative NUMBER is not changed (it is not text)', csvCell(-5) === '-5' && csvCell(-0.25) === '-0.25', '');
check('numbers and zero are untouched', csvCell(0) === '0' && csvCell(1234567) === '1234567', '');
check('null and undefined become empty', csvCell(null) === '' && csvCell(undefined) === '', '');
check('commas get quoted', csvCell('A, B') === '"A, B"', csvCell('A, B'));
check('quotes are doubled', csvCell('say "hi"') === '"say ""hi"""', csvCell('say "hi"'));
check('newlines get quoted', csvCell('a\nb') === '"a\nb"', '');
check('a formula that also has a comma is both protected and quoted', csvCell('=A1,B1') === `"'=A1,B1"`, csvCell('=A1,B1'));
const d = new Date(Date.UTC(2024, 0, 15));
check('dates are written exactly as before (String(date))', csvCell(d) === (String(d).includes(',') ? `"${String(d)}"` : String(d)), '');
check('empty list gives an empty file', toCSV([]) === '', '');
const csv = toCSV([{ owner: '=EVIL()', acres: 2.5, note: 'a,b' }, { owner: 'JONES', acres: -1, note: null }]);
check('whole file: header, protected cell, quoted comma, negative number', csv === `owner,acres,note\n'=EVIL(),2.5,"a,b"\nJONES,-1,`, JSON.stringify(csv));

console.log(results.join('\n'));
console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
