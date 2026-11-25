// Postcard templates: 3 starter designs x 3 sizes = 9 Lob HTML templates, plus merge fields and the renderer.
// PURE (no database, no network, no Node-only code) so the browser preview and the card sent to Lob come from the SAME function:
// what the user previews is the HTML Lob prints. Art is placeholder (CSS and inline SVG only, no external files or fonts).
//
// Geometry (inches). File sizes are trim + 0.125in bleed on each side (4x6 = 6.25 x 4.25, 6x9 = 9.25 x 6.25, 6x11 = 11.25 x 6.25): STANDARD print
// sizes, not confirmed from Lob's spec PDFs. The ink-free area on the BACK (Lob prints the address and postage there) is from Lob's published spec:
// 4x6: 3.2835 x 2.375; every other size: 4 x 2.375; both 0.275 from the right edge and 0.25 from the bottom edge, measured including bleed.
// Nothing of ours is ever placed inside it (tested), and the back is white so the area stays clear.

export type PostcardSize = '4x6' | '6x9' | '6x11';
export type DesignId = 'classic' | 'bold' | 'friendly';
export const SIZES: PostcardSize[] = ['4x6', '6x9', '6x11'];
export const DESIGNS: { id: DesignId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Navy and sky blue, clean and professional.' },
  { id: 'bold', name: 'Bold', blurb: 'Dark with a big yellow headline.' },
  { id: 'friendly', name: 'Friendly', blurb: 'Warm and personal, framed photo.' },
];

interface SizeSpec { w: number; h: number; inkW: number; msgMax: number; msgPt: number; headPt: number; subPt: number; nameStyle: { logoW: number; logoH: number; namePt: number; brokPt: number; phonePt: number } }
export const SIZE_SPECS: Record<PostcardSize, SizeSpec> = {
  '4x6':  { w: 6.25,  h: 4.25, inkW: 3.2835, msgMax: 280, msgPt: 10,   headPt: 15, subPt: 10, nameStyle: { logoW: 0.85, logoH: 0.85, namePt: 11, brokPt: 9,  phonePt: 12 } },
  '6x9':  { w: 9.25,  h: 6.25, inkW: 4,      msgMax: 450, msgPt: 13,   headPt: 22, subPt: 14, nameStyle: { logoW: 1.4,  logoH: 1.1,  namePt: 15, brokPt: 12, phonePt: 17 } },
  '6x11': { w: 11.25, h: 6.25, inkW: 4,      msgMax: 450, msgPt: 14,   headPt: 26, subPt: 16, nameStyle: { logoW: 1.4,  logoH: 1.1,  namePt: 15, brokPt: 12, phonePt: 17 } },
};
export const INK_H = 2.375;
export const INK_RIGHT = 0.275;
export const INK_BOTTOM = 0.25;
export const MARGIN = 0.375; // keeps our content well inside the trim

export const messageMax = (size: PostcardSize) => SIZE_SPECS[size].msgMax;

/** The rectangle on the back that must stay empty (Lob prints the address block there). Inches from the top-left of the file. */
export function inkFreeBox(size: PostcardSize) {
  const s = SIZE_SPECS[size];
  return { left: s.w - INK_RIGHT - s.inkW, top: s.h - INK_BOTTOM - INK_H, width: s.inkW, height: INK_H };
}

// ---------------------------------------------------------------- merge fields
export const MERGE_FIELDS = ['owner_name', 'property_address', 'acreage'] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export interface MergeData { ownerName: string; propertyAddress?: string; acreage?: number }

export const formatAcreage = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
export const formatPhone = (digits10: string) => `(${digits10.slice(0, 3)}) ${digits10.slice(3, 6)}-${digits10.slice(6)}`;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

export function mergeValues(m: MergeData): Record<MergeField, string> {
  return {
    owner_name: m.ownerName ? titleCase(m.ownerName.trim()) : '',
    property_address: (m.propertyAddress ?? '').trim(),
    acreage: m.acreage && m.acreage > 0 ? formatAcreage(m.acreage) : '',
  };
}

/** Replaces {{owner_name}}, {{property_address}}, {{acreage}} in the user's message. Unknown or empty fields are reported, never mailed as raw text. */
export function applyMerge(message: string, m: MergeData): { text: string; unknown: string[]; missing: string[] } {
  const vals = mergeValues(m);
  const unknown: string[] = []; const missing: string[] = [];
  const text = message.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (all, raw: string) => {
    const k = raw.toLowerCase();
    if (!(MERGE_FIELDS as readonly string[]).includes(k)) { if (!unknown.includes(raw)) unknown.push(raw); return all; }
    const v = vals[k as MergeField];
    if (!v) { if (!missing.includes(k)) missing.push(k); return all; }
    return v;
  });
  return { text, unknown, missing };
}

// ---------------------------------------------------------------- helpers
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const IMG_OK = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const img = (uri?: string) => (uri && IMG_OK.test(uri) ? uri : undefined); // only our own processed images may be embedded

const page = (w: number, h: number, css: string, body: string) =>
  `<html><head><meta charset="utf-8"><style>@page{size:${w}in ${h}in;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:${w}in;height:${h}in;overflow:hidden;font-family:Arial,Helvetica,sans-serif}.abs{position:absolute}${css}</style></head><body>${body}</body></html>`;

const hills = (c1: string, c2: string) =>
  `<svg class="abs" style="left:0;bottom:0;width:100%;height:55%" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 40V22Q15 8 32 20T64 18T100 10V40Z" fill="${c1}"/><path d="M0 40V30Q22 18 45 29T100 24V40Z" fill="${c2}"/></svg>`;

export interface PostcardSpec {
  size: PostcardSize;
  design: DesignId;
  message: string;                // already merged
  agent: { name: string; phone10: string; brokerage: string };
  merge: MergeData;
  logoDataUri?: string;
  photoDataUri?: string;
}
export interface Rendered { front: string; back: string; widthIn: number; heightIn: number }

const addrOrFallback = (m: MergeData) => (m.propertyAddress?.trim() ? m.propertyAddress.trim() : 'your property');
const acresPhrase = (m: MergeData) => (m.acreage && m.acreage > 0 ? `${formatAcreage(m.acreage)} acres` : 'your land');

// ---------------------------------------------------------------- the back (shared layout, design-specific accent)
const ACCENT: Record<DesignId, { color: string; bar: string; textColor: string }> = {
  classic: { color: '#12355b', bar: 'border-left:0.06in solid #12355b;padding-left:0.14in', textColor: '#1a1a1a' },
  bold: { color: '#1b1b1b', bar: 'border-left:0.09in solid #ffd23f;padding-left:0.14in', textColor: '#1a1a1a' },
  friendly: { color: '#2f6b3f', bar: 'border-left:0.06in solid #2f6b3f;padding-left:0.14in;border-radius:0.03in', textColor: '#2b2b2b' },
};

function backHtml(s: PostcardSpec): string {
  const z = SIZE_SPECS[s.size]; const ink = inkFreeBox(s.size); const a = ACCENT[s.design]; const ns = z.nameStyle;
  const leftW = ink.left - 0.25 - MARGIN;                       // message column: everything to the left of the ink-free area
  const rightLeft = ink.left; const rightW = z.w - MARGIN - ink.left; const rightH = ink.top - 0.15 - MARGIN; // agent block: above the ink-free area
  const logo = img(s.logoDataUri);
  const logoHtml = logo ? `<div style="width:${ns.logoW}in;height:${ns.logoH}in;flex:none;background:url(${logo}) center/contain no-repeat"></div>` : '';
  const css = `.msg{left:${MARGIN}in;top:${MARGIN}in;width:${leftW}in;height:${z.h - 2 * MARGIN}in;overflow:hidden;font-size:${z.msgPt}pt;line-height:1.38;color:${a.textColor};white-space:pre-wrap;${a.bar}}
.agent{left:${rightLeft}in;top:${MARGIN}in;width:${rightW}in;height:${rightH}in;overflow:hidden;display:flex;align-items:center;gap:0.15in}
.agent .n{font-size:${ns.namePt}pt;font-weight:700;color:${a.color}}.agent .b{font-size:${ns.brokPt}pt;color:#444;margin-top:0.03in}.agent .p{font-size:${ns.phonePt}pt;font-weight:700;color:#111;margin-top:0.06in}`;
  const body = `<div class="abs msg">${esc(s.message)}</div>
<div class="abs agent">${logoHtml}<div><div class="n">${esc(s.agent.name)}</div><div class="b">${esc(s.agent.brokerage)}</div><div class="p">${esc(formatPhone(s.agent.phone10))}</div></div></div>`;
  return page(z.w, z.h, css + 'body{background:#fff}', body);
}

// ---------------------------------------------------------------- the three fronts (each has its own numbers per size)
function frontClassic(s: PostcardSpec): string {
  const z = SIZE_SPECS[s.size]; const photo = img(s.photoDataUri); const logo = img(s.logoDataUri);
  const panelH = +(z.h * 0.38).toFixed(3); const artH = +(z.h - panelH).toFixed(3);
  const art = photo ? `<div class="abs" style="left:0;top:0;width:100%;height:${artH}in;background:url(${photo}) center/cover no-repeat"></div>`
    : `<div class="abs" style="left:0;top:0;width:100%;height:${artH}in;background:linear-gradient(#bfe0f7,#e9f2fb)"></div>${hills('#7fb069', '#4f8a3a').replace('height:55%', `top:${(artH * 0.35).toFixed(3)}in;bottom:auto;height:${(artH * 0.65).toFixed(3)}in`)}`;
  const logoPill = logo ? `<div class="abs" style="left:${MARGIN}in;top:${MARGIN}in;width:${z.nameStyle.logoW}in;height:${z.nameStyle.logoH * 0.7}in;padding:0.05in;background:#fff;border-radius:0.05in"><div style="width:100%;height:100%;background:url(${logo}) center/contain no-repeat"></div></div>` : '';
  const css = `.panel{left:0;top:${artH}in;width:100%;height:${panelH}in;background:#12355b;color:#fff;padding:${MARGIN * 0.6}in ${MARGIN}in ${MARGIN}in ${MARGIN}in;overflow:hidden}
.h{font-size:${z.headPt}pt;font-weight:700;line-height:1.2}.s{font-size:${z.subPt}pt;margin-top:0.1in;color:#cfe3f7;line-height:1.3}`;
  const body = `${art}${logoPill}<div class="abs panel"><div class="h">Are you still the owner of ${esc(addrOrFallback(s.merge))}?</div><div class="s">${s.merge.acreage ? esc(acresPhrase(s.merge)) + ' · ' : ''}I would like to make you a fair cash offer.</div></div>`;
  return page(z.w, z.h, css, body);
}

function frontBold(s: PostcardSpec): string {
  const z = SIZE_SPECS[s.size]; const photo = img(s.photoDataUri); const logo = img(s.logoDataUri);
  const bg = photo ? `background:linear-gradient(rgba(0,0,0,.58),rgba(0,0,0,.58)),url(${photo}) center/cover no-repeat`
    : 'background:repeating-linear-gradient(135deg,#222 0,#222 0.18in,#2c2c2c 0.18in,#2c2c2c 0.36in)';
  const big = s.merge.acreage ? `${formatAcreage(s.merge.acreage).toUpperCase()} ACRES` : 'YOUR LAND';
  const css = `.bg{left:0;top:0;width:100%;height:100%;${bg}}
.big{left:${MARGIN}in;top:${z.h * 0.2}in;width:${z.w - 2 * MARGIN}in;font-size:${z.headPt * 2.1}pt;font-weight:900;line-height:1;color:#ffd23f;letter-spacing:-0.01em;overflow:hidden}
.q{left:${MARGIN}in;top:${z.h * 0.2 + z.headPt * 2.1 / 72 * 1.25}in;width:${z.w - 2 * MARGIN}in;font-size:${z.subPt * 1.2}pt;color:#fff;line-height:1.3;overflow:hidden}`;
  const logoEl = logo ? `<div class="abs" style="right:${MARGIN}in;bottom:${MARGIN}in;width:${z.nameStyle.logoW}in;height:${z.nameStyle.logoH * 0.7}in;background:url(${logo}) center/contain no-repeat;"></div>` : '';
  const body = `<div class="abs bg"></div><div class="abs big">${esc(big)}</div><div class="abs q">Interested in selling ${esc(addrOrFallback(s.merge))}? Call me for a cash offer.</div>${logoEl}`;
  return page(z.w, z.h, css, body);
}

function frontFriendly(s: PostcardSpec): string {
  const z = SIZE_SPECS[s.size]; const photo = img(s.photoDataUri); const logo = img(s.logoDataUri);
  const frameW = +(z.w * 0.4).toFixed(3); const frameH = +(z.h - 2 * MARGIN).toFixed(3);
  const textW = +(z.w - frameW - 3 * MARGIN).toFixed(3);
  const name = s.merge.ownerName.trim() ? titleCase(s.merge.ownerName.trim()) : 'there';
  const frame = photo ? `background:url(${photo}) center/cover no-repeat` : 'background:linear-gradient(#cfe8c7,#a8d49a)';
  const css = `body{background:#fbf3e4}.t{left:${MARGIN}in;top:${MARGIN}in;width:${textW}in;height:${frameH}in;overflow:hidden;color:#2b2b2b;font-family:Georgia,'Times New Roman',serif}
.t .h{font-size:${z.headPt * 1.1}pt;font-weight:700;color:#2f6b3f;line-height:1.15}.t .s{font-size:${z.subPt}pt;margin-top:0.12in;line-height:1.35}
.f{left:${z.w - MARGIN - frameW}in;top:${MARGIN}in;width:${frameW}in;height:${frameH}in;border-radius:0.2in;overflow:hidden;border:0.06in solid #fff;box-shadow:none;${frame}}`;
  const logoEl = logo ? `<div class="abs" style="left:${MARGIN}in;bottom:${MARGIN}in;width:${z.nameStyle.logoW}in;height:${z.nameStyle.logoH * 0.7}in;background:url(${logo}) left center/contain no-repeat;"></div>` : '';
  const art = photo ? '' : hills('#7fb069', '#4f8a3a').replace('class="abs" style="left:0;bottom:0;width:100%;height:55%"', 'class="abs" style="left:0;bottom:0;width:100%;height:50%"');
  const body = `<div class="abs t"><div class="h">Hi ${esc(name)},</div><div class="s">I would love to make an offer on ${esc(s.merge.propertyAddress?.trim() ? s.merge.propertyAddress.trim() : 'your land')}${s.merge.acreage ? ` (${esc(acresPhrase(s.merge))})` : ''}. No agents, no fees, no hassle.</div></div><div class="abs f">${art}</div>${logoEl}`;
  return page(z.w, z.h, css, body);
}

/** The 9 templates: every design x size goes through here. */
export function renderPostcard(s: PostcardSpec): Rendered {
  const front = s.design === 'bold' ? frontBold(s) : s.design === 'friendly' ? frontFriendly(s) : frontClassic(s);
  const z = SIZE_SPECS[s.size];
  return { front, back: backHtml(s), widthIn: z.w, heightIn: z.h };
}

// ---------------------------------------------------------------- input rules shared by the API and the form
export const normalizePhone = (raw: string): string | null => {
  const d = raw.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? ten : null; // a real US number: area code and exchange do not start with 0 or 1
};
