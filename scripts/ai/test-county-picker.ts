// When does the "Choose your counties" box open? Pure logic, no database.
//   npx tsx scripts/ai/test-county-picker.ts
import { shouldOpenCountyPicker as open } from '../../lib/county-picker';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const base = { tier: 'free', trialActive: false, needsCountyRepick: false, allowance: 1, selectedCount: 0 };

check('new unpaid signup (free, no trial, nothing picked): box stays closed', open(base) === false);
check('free account that already picked its county: closed', open({ ...base, selectedCount: 1 }) === false);
check('free account on an active trial with a slot open: opens', open({ ...base, trialActive: true }) === true);
check('paid scout, no county yet: opens', open({ ...base, tier: 'scout' }) === true);
check('paid pro with 1 of 3 counties picked: opens', open({ ...base, tier: 'pro', allowance: 3, selectedCount: 1 }) === true);
check('paid pro with all 3 picked: closed', open({ ...base, tier: 'pro', allowance: 3, selectedCount: 3 }) === false);
check('downgrade asking for a re-pick opens, even on the free tier', open({ ...base, needsCountyRepick: true, selectedCount: 1 }) === true);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL PASS' : 'FAILURES');
process.exit(fail === 0 ? 0 : 1);
