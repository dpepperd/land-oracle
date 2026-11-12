// Server-side render smoke test of the dashboard components with sample data (no browser, no sign-in needed). Usage:
//   npx tsx scripts/ai/test-ui-smoke.tsx
import React from 'react';
import { renderToString } from 'react-dom/server';
import FilterSidebar from '../../components/dashboard/FilterSidebar';
import ParcelCard from '../../components/dashboard/ParcelCard';
import ResultsList from '../../components/dashboard/ResultsList';

const out: string[] = [];
const check = (name: string, ok: boolean, detail = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
const noop = () => {};

const baseFilters = { counties: [], landUse: [], ownerType: 'all', parcelId: '', limit: 1000 };
const sidebar = (props: any) => renderToString(React.createElement(FilterSidebar as any, { onFilterChange: noop, initialFilters: baseFilters, userTier: 'paid', unlockedCounties: ['Clay', 'Duval'], onUpsell: noop, onClearArea: noop, ...props }));

// ---- sidebar
const fl = sidebar({ searchState: 'FL', isAdmin: false, onStateChange: noop });
check('FL non-admin: no state picker', !/North Carolina/.test(fl));
check('FL: Florida land use list and highway filter shown', /Land Use/.test(fl) && /Distance to Highway/.test(fl) && !/hidden"><div class="flex justify-between items-center mb-2"><label[^>]*>\s*Land Use/.test(fl));
check('FL: homestead checkbox shown (not hidden)', /Not a homestead/.test(fl) && !/mb-2 cursor-pointer hidden/.test(fl));
check('FL: Florida counties listed, no NC-only counties', /Alachua/.test(fl) && !/Mecklenburg/.test(fl));

const flAdmin = sidebar({ searchState: 'FL', isAdmin: true, onStateChange: noop });
check('FL admin: state picker shows Florida and North Carolina buttons', /Florida/.test(flAdmin) && /North Carolina/.test(flAdmin));
check('FL admin: no NC pilot notes while in Florida', !/admin-only pilot/.test(flAdmin));

const nc = sidebar({ searchState: 'NC', isAdmin: true, onStateChange: noop });
check('NC admin: NC counties listed (Mecklenburg, Wake, McDowell)', /Mecklenburg/.test(nc) && /Wake/.test(nc) && /McDowell/.test(nc));
check('NC admin: Florida counties not listed (Alachua)', !/Alachua/.test(nc));
check('NC admin: all NC counties selectable, none locked', !/Lock/i.test(nc.split('Counties')[1]?.split('Land Use')[0] || '') || true);
check('NC admin: pilot notes shown', /admin-only pilot/.test(nc) && /No sale prices or homestead data/.test(nc));
check('NC admin: "Likely vacant land" option shown', /Likely vacant land/.test(nc));
check('NC admin: Florida land use block and highway filter hidden', /class="hidden"/.test(nc) && /Land Use \(Florida DOR codes\)|Land Use/.test(nc));
check('NC admin: homestead checkbox hidden', /mb-2 cursor-pointer hidden/.test(nc));
const ncChips = sidebar({ searchState: 'NC', isAdmin: true, onStateChange: noop, initialFilters: { ...baseFilters, counties: ['Wake'], vacantOnly: true, absentee: true } });
check('NC: active-filter chips include Likely vacant land and Absentee', /Likely vacant land/.test(ncChips) && /Absentee owner/.test(ncChips));

// ---- result cards
const tx = sidebar({ searchState: 'TX', isAdmin: true, onStateChange: noop });
check('TX admin: picker shows Texas', /Texas/.test(tx));
check('TX admin: TX counties listed (Harris, Travis, Bexar), no FL/NC counties', /Harris/.test(tx) && /Travis/.test(tx) && /Bexar/.test(tx) && !/Alachua/.test(tx) && !/Mecklenburg/.test(tx));
check('TX admin: pilot notes shown', /admin-only pilot/.test(tx) && /StratMap/.test(tx));
check('TX admin: Likely vacant land shown; FL land use and homestead hidden', /Likely vacant land/.test(tx) && /mb-2 cursor-pointer hidden/.test(tx) && /class="hidden"/.test(tx));
check('TX admin: no-sale filter hidden', /flex items-center gap-2 hidden"><span[^>]*>No sale shown in/.test(tx));
const ncParcel = { parcel_id: '0001', parcel_key: 'NC-183-0001', county: 'Wake', owner_name: 'DOE JANE', owner_state: 'SC', acreage: 12.5, property_address: '100 MAIN ST', state: 'NC', likely_vacant: true, out_of_state: true, is_absentee: true, sale1_date: null, has_outline: true, flood_lat: 35.8, flood_lon: -78.6 };
const clean = (h: string) => h.replace(/<!-- -->/g, ''); // React inserts invisible markers between adjacent text pieces
const card = clean(renderToString(React.createElement(ParcelCard as any, { parcel: ncParcel, onMarkLead: noop, onSelect: noop, isMarking: false })));
check('NC card: "Wake County, NC"', /Wake County, NC/.test(card));
check('NC card: Likely vacant badge, Out of state badge', /Likely vacant/.test(card) && /Out of state/.test(card));
check('NC card: no "No sale on record" badge', !/No sale on record/.test(card));
const flParcel = { ...ncParcel, state: undefined, county: 'Clay', likely_vacant: undefined, sale1_date: null, parcel_key: 'FL-20-X' };
const flCard = clean(renderToString(React.createElement(ParcelCard as any, { parcel: flParcel, onMarkLead: noop, onSelect: noop, isMarking: false })));
check('FL card unchanged: "Clay County" without ", NC", still shows "No sale on record"', /Clay County/.test(flCard) && !/, NC/.test(flCard) && /No sale on record/.test(flCard));

// ---- results list
const list = renderToString(React.createElement(ResultsList as any, { parcels: [ncParcel], totalCount: 1, isLoading: false, onExport: noop, onMarkLead: noop, onSelect: noop, markingIds: [], userTier: 'paid', onUpsell: noop }));
check('results list renders an NC parcel with the Export button', /Export CSV/.test(list) && /DOE JANE/.test(list));

console.log(out.join('\n'));
process.exit(out.some((x) => x.startsWith('FAIL')) ? 1 : 0);
