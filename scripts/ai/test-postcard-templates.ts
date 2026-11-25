// Postcard templates: 3 designs x 3 sizes = 9 Lob HTML templates, merge fields, required fields, and the rule that nothing of ours
// is ever placed in the area Lob reserves for the address. Pure: no database, no network. Usage: npx tsx scripts/ai/test-postcard-templates.ts
import { DESIGNS, INK_BOTTOM, INK_H, INK_RIGHT, MARGIN, SIZES, SIZE_SPECS, applyMerge, formatAcreage, inkFreeBox, mergeValues, messageMax, normalizePhone, renderPostcard, type PostcardSpec } from '../../lib/wallet/templates';
import { postcardSchema, buildSpec } from '../../lib/wallet/postcards';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const base = (size: any, design: any, over: Partial<PostcardSpec> = {}): PostcardSpec => ({
  size, design, message: 'Hello there, I would like to make an offer on your land.',
  agent: { name: 'Alex Agent', phone10: '5555550123', brokerage: 'Sunshine Realty' },
  merge: { ownerName: 'PAT OWNER', propertyAddress: '123 County Road 4, Tampa, FL', acreage: 12.5 }, ...over,
});

// inches -> numbers from a ".cls{left:Xin;top:Yin;width:Win;height:Hin" rule in the generated back HTML
const rect = (html: string, cls: string) => {
  const m = html.match(new RegExp(`\\.${cls}\\{left:([\\d.]+)in;top:([\\d.]+)in;width:([\\d.]+)in;height:([\\d.]+)in`));
  return m ? { left: +m[1], top: +m[2], width: +m[3], height: +m[4] } : null;
};
const overlaps = (a: any, b: any) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

// ---- sizes and the address area
check('three sizes, 4x6 first (the default)', SIZES.join() === '4x6,6x9,6x11', SIZES.join());
check('file sizes: 6.25x4.25, 9.25x6.25, 11.25x6.25 (trim + .125 bleed)', SIZE_SPECS['4x6'].w === 6.25 && SIZE_SPECS['4x6'].h === 4.25 && SIZE_SPECS['6x9'].w === 9.25 && SIZE_SPECS['6x11'].w === 11.25 && SIZE_SPECS['6x11'].h === 6.25, '');
const ink46 = inkFreeBox('4x6'), ink69 = inkFreeBox('6x9');
check("ink-free area from Lob's spec: 4x6 is 3.2835 x 2.375, others 4 x 2.375, .275 from the right, .25 from the bottom", ink46.width === 3.2835 && ink69.width === 4 && ink46.height === 2.375 && INK_RIGHT === 0.275 && INK_BOTTOM === 0.25 && Math.abs(ink46.left + ink46.width + INK_RIGHT - 6.25) < 1e-9 && Math.abs(ink69.top + INK_H + INK_BOTTOM - 6.25) < 1e-9, JSON.stringify(ink46));

// ---- the 9 templates
check('three designs', DESIGNS.length === 3 && DESIGNS.map((d) => d.id).join() === 'classic,bold,friendly', '');
const fronts = new Set<string>(); const backs = new Set<string>();
for (const size of SIZES) for (const d of DESIGNS) {
  const r = renderPostcard(base(size, d.id));
  const z = SIZE_SPECS[size];
  fronts.add(r.front); backs.add(r.back);
  check(`${d.id} ${size}: page is ${z.w} x ${z.h} in, front and back are full HTML documents`, r.widthIn === z.w && r.heightIn === z.h && r.front.startsWith('<html>') && r.back.startsWith('<html>') && r.front.includes(`width:${z.w}in;height:${z.h}in`) && r.back.includes(`width:${z.w}in;height:${z.h}in`) && r.back.includes(`size:${z.w}in ${z.h}in`), '');
  const ink = inkFreeBox(size);
  const msg = rect(r.back, 'msg'), agent = rect(r.back, 'agent');
  check(`${d.id} ${size}: message and agent block exist and stay OUT of the address area`, !!msg && !!agent && !overlaps(msg, ink) && !overlaps(agent, ink), JSON.stringify({ msg, agent, ink }));
  check(`${d.id} ${size}: back content keeps ${MARGIN} in from every file edge`, !!msg && !!agent && msg.left >= MARGIN - 1e-9 && msg.top >= MARGIN - 1e-9 && msg.top + msg.height <= z.h - MARGIN + 1e-9 && agent.left + agent.width <= z.w - MARGIN + 1e-9 && agent.top >= MARGIN - 1e-9, '');
  check(`${d.id} ${size}: the back is white (the address area must stay clear)`, /body\{background:#fff\}/.test(r.back) && !/url\(/.test(r.back.replace(/url\(data:[^)]*\)/g, '')), '');
  check(`${d.id} ${size}: agent name, brokerage and formatted phone are on the back`, r.back.includes('Alex Agent') && r.back.includes('Sunshine Realty') && r.back.includes('(555) 555-0123'), '');
  check(`${d.id} ${size}: the front uses the merge fields (address and acreage or owner)`, r.front.includes('123 County Road 4') && (r.front.includes('12.5') || r.front.includes('Pat Owner')), '');
}
check('all 9 fronts are different HTML, all 9 backs are different HTML', fronts.size === 9 && backs.size === 9, `${fronts.size}/${backs.size}`);

// ---- merge fields
check('formatAcreage trims zeros: 12.5, 40, 0.25, 7.33', formatAcreage(12.5) === '12.5' && formatAcreage(40) === '40' && formatAcreage(0.25) === '0.25' && formatAcreage(7.333) === '7.33', '');
const mv = mergeValues({ ownerName: 'SMITH JOHN A', propertyAddress: ' 1 Main St ', acreage: 5 });
check('merge values: owner name title-cased, address trimmed, acreage as text', mv.owner_name === 'Smith John A' && mv.property_address === '1 Main St' && mv.acreage === '5', JSON.stringify(mv));
const m1 = applyMerge('Hi {{owner_name}}, your {{ acreage }} acres at {{PROPERTY_ADDRESS}}.', { ownerName: 'PAT OWNER', propertyAddress: '1 Main St', acreage: 5 });
check('message merge fills all three fields (spaces and capitals allowed)', m1.text === 'Hi Pat Owner, your 5 acres at 1 Main St.' && !m1.unknown.length && !m1.missing.length, m1.text);
const m2 = applyMerge('Your {{acreage}} acres {{bogus}}', { ownerName: 'X', propertyAddress: '', acreage: undefined });
check('an empty field and an unknown field are reported, never mailed as raw text', m2.missing[0] === 'acreage' && m2.unknown[0] === 'bogus', JSON.stringify(m2));
const noAddr = renderPostcard(base('4x6', 'classic', { merge: { ownerName: 'Pat', propertyAddress: '', acreage: undefined } }));
check('front falls back to "your property" / "your land" when the address or acreage is blank', noAddr.front.includes('your property') && !noAddr.front.includes('undefined') && !noAddr.front.includes('NaN'), '');

// ---- safety: nothing the user types can inject markup; only our own processed images embed
const evil = renderPostcard(base('6x9', 'friendly', { message: '<script>alert(1)</script><img src=x onerror=alert(2)>', agent: { name: '<b>Al</b>', phone10: '5555550123', brokerage: 'A & B "Realty"' }, merge: { ownerName: '<i>Pat</i>', propertyAddress: '"><script>x()</script>', acreage: 3 } }));
check('typed text is escaped on both sides (no live <script>, <img>, <b> or <i>)', ![evil.front, evil.back].some((h) => /<script|<img|<b>|<i>/.test(h.replace(/<(\/?)(html|head|meta|style|body|div|svg|path)\b/g, ''))), '');
check('an ampersand and quotes in the brokerage name are escaped', evil.back.includes('A &amp; B &quot;Realty&quot;'), '');
const bad = renderPostcard(base('4x6', 'bold', { photoDataUri: 'https://evil.example/x.png', logoDataUri: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }));
check('web addresses and SVG are never embedded as images', !bad.front.includes('evil.example') && !bad.front.includes('svg+xml') && !bad.back.includes('svg+xml'), '');
const good = renderPostcard(base('4x6', 'classic', { photoDataUri: PNG, logoDataUri: PNG }));
check('processed PNG/JPEG data images ARE embedded (photo on the front, logo on both)', good.front.includes(PNG) && good.back.includes(PNG), '');

// ---- message limits per size
check('back message limit per size: 4x6 holds the least', messageMax('4x6') === 280 && messageMax('6x9') === 450 && messageMax('6x11') === 450, '');

// ---- required fields and phone (the schema the API and the form use)
const input = (over: any = {}) => ({ message: 'Hi {{owner_name}}, call me.', agent: { name: 'Alex Agent', phone: '(555) 555-0123', brokerage: 'Sunshine Realty' }, to: { name: 'Pat Owner', line1: '10 Main St', city: 'Tampa', state: 'fl', zip: '33602' }, propertyAddress: '12 CR 4', acreage: 12.5, ...over });
const parse = (o: any) => postcardSchema.safeParse(o);
const first = (o: any) => { const r = parse(o); return r.success ? '' : r.error.issues[0].message; };
const okParsed = parse(input());
check('a complete card is valid; defaults to 4x6 and the classic design; state is upper-cased', okParsed.success && okParsed.data.size === '4x6' && okParsed.data.design === 'classic' && okParsed.data.to.state === 'FL', '');
check('required: agent name', /agent name/i.test(first(input({ agent: { name: '', phone: '(555) 555-0123', brokerage: 'B' } }))), first(input({ agent: { name: '', phone: '(555) 555-0123', brokerage: 'B' } })));
check('required: agent phone', /phone/i.test(first(input({ agent: { name: 'Al', phone: '', brokerage: 'B' } }))), '');
check('required: brokerage name', /brokerage/i.test(first(input({ agent: { name: 'Al', phone: '(555) 555-0123', brokerage: '' } }))), '');
check('required: the agent block cannot be left out at all', !parse({ ...input(), agent: undefined }).success, '');
check('phone must be a real US number (not 12345, not area code 000, not letters)', ['12345', '(000) 555-0123', 'call me', '555-0123'].every((p) => !parse(input({ agent: { name: 'Al', phone: p, brokerage: 'B' } })).success), '');
check('phone formats accepted: (555) 555-0123, 555.555.0123, +1 555 555 0123', ['(555) 555-0123', '555.555.0123', '+1 555 555 0123'].every((p) => normalizePhone(p) === '5555550123'), '');
check('a size outside 4x6 / 6x9 / 6x11 is refused', !parse(input({ size: '8x10' })).success, '');
check('merge field used but empty: refused with the field name', /\{\{acreage\}\}/.test(first(input({ message: 'You have {{acreage}} acres', acreage: undefined }))), first(input({ message: 'You have {{acreage}} acres', acreage: undefined })));
check('unknown merge field: refused', /Unknown merge field/.test(first(input({ message: 'Hi {{nickname}}' }))), '');
check('message over the size limit (after merging) is refused, under it is fine', !parse(input({ size: '4x6', message: 'x'.repeat(281) })).success && parse(input({ size: '4x6', message: 'x'.repeat(280) })).success && parse(input({ size: '6x9', message: 'x'.repeat(450) })).success, '');
check('the limit counts the MERGED text, not the {{...}} tags (long tags, short result: ok; short tags, long result: refused)', parse(input({ size: '4x6', message: '{{property_address}} '.repeat(16), propertyAddress: 'ab' })).success === true && parse(input({ size: '4x6', message: '{{property_address}} '.repeat(16), propertyAddress: 'abcdefghijklmnopqrst' })).success === false, '');
check('acreage must be positive; property address max 80', !parse(input({ acreage: 0 })).success && !parse(input({ acreage: -3 })).success && !parse(input({ propertyAddress: 'x'.repeat(81) })).success, '');
const spec = buildSpec(okParsed.success ? okParsed.data : (null as any), {});
check('buildSpec merges the message and normalizes the phone', spec.message === 'Hi Pat Owner, call me.' && spec.agent.phone10 === '5555550123', spec.message);

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
