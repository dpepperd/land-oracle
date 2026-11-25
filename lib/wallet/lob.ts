// Lob (postcards + US address verification). A thin client with an injectable fetch so it can be tested without the network.
// TEST KEYS ONLY: a live key (live_...) is refused unless LOB_ALLOW_LIVE=true, so a wrong key in the environment cannot mail real cards.
export class LobError extends Error {
  code: 'not_configured' | 'live_key_blocked' | 'unavailable' | 'rejected';
  constructor(code: LobError['code'], message: string) { super(message); this.name = 'LobError'; this.code = code; }
}

/** First Class for every size: faster than Standard, and 4x6 is only offered in First Class. use_type is Lob's required marketing/operational label: these are marketing mailings. */
export const MAIL_TYPE = 'usps_first_class';
export const USE_TYPE = 'marketing';

export interface UsAddress { name?: string; line1: string; line2?: string; city: string; state: string; zip: string }
export type Verification =
  | { ok: true; address: UsAddress; deliverability: string }
  | { ok: false; deliverability: string; reason: string };

export interface LobClient {
  verify(a: UsAddress): Promise<Verification>;
  createPostcard(p: { to: UsAddress; from: UsAddress; front: string; back: string; size: '4x6' | '6x9' | '6x11'; description: string; idempotencyKey: string }): Promise<{ id: string }>;
  cancelPostcard(id: string): Promise<void>;
}

/** Plain-words reason for every verdict Lob can give. Only "deliverable" and "deliverable_unnecessary_unit" may be mailed. */
export function judge(deliverability: string): { ok: boolean; reason: string } {
  switch (deliverability) {
    case 'deliverable': return { ok: true, reason: '' };
    case 'deliverable_unnecessary_unit': return { ok: true, reason: '' };
    case 'deliverable_missing_unit': return { ok: false, reason: 'This address needs an apartment, suite or unit number.' };
    case 'deliverable_incorrect_unit': return { ok: false, reason: 'The apartment, suite or unit number does not match postal records.' };
    case 'undeliverable': return { ok: false, reason: 'The U.S. Postal Service cannot deliver to this address.' };
    default: return { ok: false, reason: 'This address could not be confirmed as deliverable.' };
  }
}

type FetchLike = (url: string, init: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export function makeLobClient(opts: { apiKey?: string; fetchImpl?: FetchLike } = {}): LobClient {
  const apiKey = opts.apiKey ?? process.env.LOB_API_KEY ?? '';
  const f: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init) as any);
  const guard = () => {
    if (!apiKey) throw new LobError('not_configured', 'Postcards are not set up yet.');
    if (!apiKey.startsWith('test_') && process.env.LOB_ALLOW_LIVE !== 'true') throw new LobError('live_key_blocked', 'Postcards are in test mode only for now.');
  };
  const call = async (method: string, path: string, body?: any, extra: Record<string, string> = {}) => {
    guard();
    let res;
    try {
      res = await f(`https://api.lob.com/v1${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64'), ...extra },
        body: body ? JSON.stringify(body) : undefined,
        signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(20_000) : undefined,
      });
    } catch {
      throw new LobError('unavailable', 'The mailing service is not reachable right now.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message;
      if (res.status === 422 || res.status === 400) throw new LobError('rejected', typeof msg === 'string' ? msg : 'The mailing service refused the request.');
      throw new LobError('unavailable', 'The mailing service is not available right now.');
    }
    return json;
  };
  const toLob = (a: UsAddress) => ({ name: a.name, address_line1: a.line1, address_line2: a.line2 || undefined, address_city: a.city, address_state: a.state, address_zip: a.zip });

  return {
    async verify(a) {
      const j = await call('POST', '/us_verifications', { primary_line: a.line1, secondary_line: a.line2 || '', city: a.city, state: a.state, zip_code: a.zip });
      const d = String(j?.deliverability ?? '');
      const verdict = judge(d);
      if (!verdict.ok) return { ok: false, deliverability: d, reason: verdict.reason };
      const c = j.components ?? {};
      return {
        ok: true, deliverability: d,
        address: {
          name: a.name,
          line1: j.primary_line || a.line1,
          line2: j.secondary_line || undefined,
          city: c.city || a.city,
          state: c.state || a.state,
          zip: c.zip_code ? (c.zip_code_plus_4 ? `${c.zip_code}-${c.zip_code_plus_4}` : c.zip_code) : a.zip,
        },
      };
    },
    async createPostcard(p) {
      const j = await call('POST', '/postcards', { description: p.description, to: toLob(p.to), from: toLob(p.from), front: p.front, back: p.back, size: p.size, mail_type: MAIL_TYPE, use_type: USE_TYPE }, { 'Idempotency-Key': p.idempotencyKey });
      if (!j?.id) throw new LobError('unavailable', 'The mailing service gave an unexpected answer.');
      return { id: String(j.id) };
    },
    async cancelPostcard(id) { await call('DELETE', `/postcards/${encodeURIComponent(id)}`); },
  };
}
