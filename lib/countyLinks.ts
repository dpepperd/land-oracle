type CountyConfig = 
  | { type: 'schneider'; appId: string; layerId: string; pageId: string; useAltId?: boolean }
  | { type: 'custom'; urlBuilder: (id: string, altId?: string) => string; copyKey?: string };

const COUNTY_CONFIGS: Record<string, CountyConfig> = {
  'baker': {
    type: 'custom',
    urlBuilder: (id) => {
      // Baker removes dashes/spaces for its PHP search
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      return `https://bakerpa.com/propertydetails.php?parcel=${clean}`;
    }
  },

  'okaloosa': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB: 251S241570000A0010 (18 digits)
        // Format: 25-1S-24-1570-000A-0010
        if (id && id.length === 18) {
             const formatted = `${id.substring(0,2)}-${id.substring(2,4)}-${id.substring(4,6)}-${id.substring(6,10)}-${id.substring(10,14)}-${id.substring(14,18)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=855&LayerID=15999&PageTypeID=4&PageID=7113&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=855&LayerID=15999&PageTypeID=4&PageID=7113&KeyValue=${id}`;
    }
  },
  'santa rosa': {
    type: 'custom',
    urlBuilder: (id) => `https://srcpa.gov/parcel?id=${id}`
  },
  'polk': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.polkflpa.gov/CamaSearch.aspx' // Polk - Auto-copies ID (Manual Search)
  },
  'hernando': {
    type: 'custom',
    urlBuilder: (id) => 'https://propsearch.hernandocountypa-florida.us/Default.aspx' // Manual Search - copy ID
  },
  'citrus': {
    type: 'custom',
    urlBuilder: (id, altId) => `https://www.citruspa.org/_web/search/commonsearch.aspx?mode=parid&parid=${altId || id}`,
    copyKey: 'alt_key'
  },
  'indian river': {
    type: 'schneider',
    appId: '1109',
    layerId: '27655',
    pageId: '11279'
  },
  'desoto': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.desotopa.com/gis/' // Manual Search - copy ID
  },
  'hardee': {
    type: 'custom',
    urlBuilder: (id) => {
        // Hardee qPublic requires dashes: "10-33-24-0000-06230-0000"
        // Raw: 1033240000062300000 (19 digits)
        const clean = id.replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length === 19) {
            const formatted = `${clean.slice(0,2)}-${clean.slice(2,4)}-${clean.slice(4,6)}-${clean.slice(6,10)}-${clean.slice(10,15)}-${clean.slice(15,19)}`;
            return `https://qpublic.schneidercorp.com/Application.aspx?AppID=813&LayerID=14471&PageTypeID=4&PageID=6254&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=813&LayerID=14471&PageTypeID=4&PageID=6254&KeyValue=${id}`;
    }
  },
  'highlands': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.hcpao.org/Search' // Manual Search
  },
  'hillsborough': {
    type: 'custom',
    urlBuilder: (id) => `https://gis.hcpafl.org/propertysearch/#/parcel/basic/${id}`
  },
  'pinellas': {
    type: 'custom',
    urlBuilder: (id) => {
      // DB: Range-Township-Section (14-30-01...)
      // Web: Section-Township-Range (01-30-14...)
      const parts = id.trim().replace(/\s+/g, '-').split('-');
      if (parts.length >= 3) {
          const [range, township, section, ...rest] = parts;
          const swappedId = `${section}-${township}-${range}-${rest.join('-')}`;
          return `https://www.pcpao.gov/property-details?parcel=${swappedId}`;
      }
      return `https://www.pcpao.gov/property-details?parcel=${id.replace(/ /g, '-')}`;
    }
  },
  'brevard': {
    type: 'custom',
    urlBuilder: (id, altId) => {
        // Brevard Property Appraiser uses specific "account" links with hash router
        // Example: https://www.bcpao.us/propertysearch/#/account/2444542
        if (altId) return `https://www.bcpao.us/propertysearch/#/account/${altId}`;
        
        // Fallback: If no account number, maybe search (but difficult with hash router params)
        // We'll just default to the Account link if we have id, assuming id might be account# in some contexts?
        // But likely we have parcelNO as altId.
        return `https://www.bcpao.us/propertysearch/#/account/${id}`; 
    }
  },
  'clay': {
    type: 'schneider',
    appId: '830',
    layerId: '15008',
    pageId: '6756'
  },
  'duval': {
    type: 'custom',
    urlBuilder: (id) => {
      // Duval (COJ.net) uses "RE" parameter, stripped of dashes
      // Example: 005836-0000 -> 0058360000
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      return `https://paopropertysearch.coj.net/Basic/Detail.aspx?RE=${clean}`;
    }
  },
  'saint johns': {
    type: 'schneider',
    appId: '960',
    layerId: '21179',
    pageId: '9059'
  },
  'nassau': {
    type: 'custom',
    urlBuilder: (id) => {
      // Nassau Format: XX-XX-XX-XXXX-XXXX-XXXX (18 chars, can include letters like '1N')
      // Example: 06-1N-23-0325-0005-0000
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      if (clean.length === 18) {
         const formatted = `${clean.slice(0,2)}-${clean.slice(2,4)}-${clean.slice(4,6)}-${clean.slice(6,10)}-${clean.slice(10,14)}-${clean.slice(14,18)}`;
         return `https://maps.ncpafl.com/NassauDetails/ParcelSearchResults.html?PIN=${formatted}`;
      }
      return `https://maps.ncpafl.com/NassauDetails/ParcelSearchResults.html?PIN=${id}`;
    }
  },
  'union': {
    type: 'custom',
    urlBuilder: (id) => `https://union.floridapa.com/GIS` // User Preferred GIS Map
  },
  'alachua': {
    type: 'custom',
    urlBuilder: (id) => {
      // Alachua qPublic: AppID=1081... KeyValue=09484-000-000
      // Format: XXXXX-XXX-XXX (11 digits)
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      let formatted = clean;
      if (clean.length === 11) {
         formatted = `${clean.slice(0,5)}-${clean.slice(5,8)}-${clean.slice(8,11)}`;
      }
      return `https://qpublic.schneidercorp.com/Application.aspx?AppID=1081&LayerID=26490&PageTypeID=4&PageID=10770&KeyValue=${formatted}`;
    }
  },
  'bradford': {
    type: 'custom',
    urlBuilder: (id) => 'https://bradfordappraiser.com/gis' 
  },
  'flagler': {
    type: 'schneider',
    appId: '598',
    layerId: '9801', 
    pageId: '4330'
  },
  'volusia': {
    type: 'custom',
    urlBuilder: (id) => `https://vcpa.vcgov.org/parcel/summary/?altkey=${id}`
  },
  'marion': {
    type: 'custom',
    urlBuilder: (id) => `https://www.pa.marion.fl.us/PropertySearch.aspx?SearchBy=ParcelR&Parms=${id}`
  },
  'seminole': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.scpafl.org/search/parcels' // Manual Search - Clipboard Copy triggers on frontend
  },
  'putnam': {
    type: 'custom',
    urlBuilder: (id) => 'https://pamap.putnam-fl.gov/PropertyAppraiserPublicMap/' // Manual Search Required
  },
  'lake': {
    type: 'custom',
    urlBuilder: (id, altId) => `https://lakecopropappr.com/property-details.aspx?AltKey=${altId || id}`
  },
  'orange': {
    type: 'custom',
    urlBuilder: (id) => 'https://ocpaweb.ocpafl.org/parcelsearch' // Manual Search
  },
  'sumter': {
    type: 'schneider', // Assuming 'qpublic' in instruction meant 'schneider'
    appId: '1207',
    layerId: '36374',
    pageId: '13872'
  },
  'osceola': {
      type: 'custom',
      urlBuilder: (id) => 'https://search.property-appraiser.org/Search/MainSearch' // SPA - Auto-copies ID
  },
  'st. lucie': {
    type: 'custom',
    urlBuilder: (id, altId) => `https://apps.paslc.gov/rerecordcard/${altId || id}`
  },
  'broward': {
    type: 'custom',
    urlBuilder: (id) => 'https://web.bcpa.net/bcpaclient/#/Record-Search' // Manual Search - Clipboard Copy
  },
  'miami-dade': {
    type: 'custom',
    urlBuilder: (id) => {
        // MDPA Format: https://apps.miamidadepa.gov/PropertySearch/#/?folio={ID}
        // Example: 1079190281380
        const clean = id.replace(/[^0-9]/g, '');
        return `https://apps.miamidadepa.gov/PropertySearch/#/?folio=${clean}`;
    }
  },
  'saint lucie': {
    type: 'custom',
    urlBuilder: (id, altId) => `https://apps.paslc.gov/rerecordcard/${altId || id}`
  },
  'martin': {
    type: 'custom',
    urlBuilder: (id, altId) => `https://www.pamartinfl.gov/app/search/view/${altId || id}`
  },
  'manatee': {
    type: 'custom',
    urlBuilder: (id) => `https://www.manateepao.gov/parcel/?parid=${id}`
  },
  'okeechobee': { 
    type: 'custom',
    urlBuilder: (id) => 'https://www.okeechobeepa.com/gis/' // Locked Page - Clipboard Assisted
  },
  'glades': {
    type: 'custom',
    urlBuilder: (id) => {
        // Glades qPublic Format: A05-41-31-A00-002A-0000 (18 chars with dashes)
        // Raw: A054131A00002A0000
        const clean = id.replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length === 18) {
             const formatted = `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5,7)}-${clean.slice(7,10)}-${clean.slice(10,14)}-${clean.slice(14,18)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=818&LayerID=14562&PageTypeID=4&PageID=6422&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=818&LayerID=14562&PageTypeID=4&PageID=6422&KeyValue=${id}`;
    }
  },
  'hendry': {
    type: 'schneider',
    appId: '1105',
    layerId: '27399',
    pageId: '11143' 
  },
  'palm beach': {
    type: 'custom',
     urlBuilder: (id) => {
        // PAPA Format: https://pbcpao.gov/Property/Details?parcelId={ID}
        // Example: 36434220010070010
        const clean = id.replace(/[^a-zA-Z0-9]/g, '');
        return `https://pbcpao.gov/Property/Details?parcelId=${clean}`;
    }
  },
  'monroe': {
    type: 'schneider',
    appId: '605',
    layerId: '9946',
    pageId: '7635',
    useAltId: true
  },
  'collier': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.collierappraiser.com/Main_Search/search_rp.html#TabParcel' // Manual Search - Clipboard Copy
  },
  'lee': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.leepa.org/Search/PropertySearch.aspx' // Manual Search - Clipboard Copy
  },
  'charlotte': {
    type: 'custom',
    urlBuilder: (id) => `https://www.ccappraiser.com/Show_parcel.asp?acct=${id}&gen=T&tax=T&bld=T&oth=T&sal=T&lnd=T&leg=T`
  },
  'sarasota': {
    type: 'custom',
    urlBuilder: (id) => {
      // Sarasota Format: https://www.sc-pa.com/propertysearch/parcel/details/{ID}
      // Example: 0000007000
      return `https://www.sc-pa.com/propertysearch/parcel/details/${id}`;
    }
  },
  'pasco': {
    type: 'custom',
    urlBuilder: (id) => {
        // Pasco Deep Link: https://search.pascopa.com/parcel.aspx?parcel=33-25-16-0060-00G00-0040
        // Strip "Pasco-" prefix, but KEEP dashes in the ID itself.
        // Internal ID: Pasco-33-25-16... -> Clean: 33-25-16...
        const clean = id.replace(/^Pasco[- ]?/i, '');
        return `https://search.pascopa.com/parcel.aspx?parcel=${clean}`;
    }
  },

  // Levy County (Manual Search initially)
  'levy': {
    type: 'schneider',
    appId: '930',
    layerId: '18185',
    pageId: '8127'
  },
  'dixie': {
    type: 'custom',
    urlBuilder: (id) => {
        // Dixie Format: 18-11-12-0000-2850-0000 (2-2-2-4-4-4)
        const f = id.replace(/[^0-9]/g, '');
        if (f.length === 18) {
             const fmt = `${f.slice(0,2)}-${f.slice(2,4)}-${f.slice(4,6)}-${f.slice(6,10)}-${f.slice(10,14)}-${f.slice(14)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=867&LayerID=16385&PageTypeID=4&PageID=7232&KeyValue=${fmt}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=867&LayerID=16385&PageTypeID=4&PageID=7232&KeyValue=${id}`;
    }
  },
  'gilchrist': {
    type: 'custom',
    urlBuilder: (id) => {
        // Gilchrist Format: 08-07-15-0000-0009-0020 (Matches Dixie 2-2-2-4-4-4)
        const f = id.replace(/[^0-9]/g, '');
        if (f.length === 18) {
             const fmt = `${f.slice(0,2)}-${f.slice(2,4)}-${f.slice(4,6)}-${f.slice(6,10)}-${f.slice(10,14)}-${f.slice(14)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=820&LayerID=15174&PageTypeID=4&PageID=6883&KeyValue=${fmt}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=820&LayerID=15174&PageTypeID=4&PageID=6883&KeyValue=${id}`;
    }
  },
  'columbia': {
    type: 'custom',
    urlBuilder: (id) => `https://columbia.floridapa.com/gis/` // Copy ID + Manual Search
  },
  'lafayette': {
    type: 'custom',
    urlBuilder: (id) => `https://lafayettepa.com/gis/` // GrizzlyLogic - Manual Search
  },
  'suwannee': {
    type: 'custom',
    urlBuilder: (id) => `https://suwanneepa.com/gis/` // GrizzlyLogic - Manual Search
  },
  'hamilton': {
    type: 'custom',
    urlBuilder: (id) => {
        // User provided example: 3776-000 (7 digits -> 4-3 split)
        // IDs in DB are raw 7 digits (e.g., 3724440)
        let formatted = id;
        if (id.length === 7) {
            formatted = `${id.slice(0, 4)}-${id.slice(4)}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=817&LayerID=14544&PageTypeID=4&PageID=6411&KeyValue=${formatted}`;
    }
  },
  'taylor': {
    type: 'custom',
    urlBuilder: (id) => `https://beacon.schneidercorp.com/Application.aspx?AppID=792&LayerID=11749&PageTypeID=4&PageID=5270&KeyValue=${id}` 
  },
  'madison': {
    type: 'custom',
    urlBuilder: (id) => `https://www.madisoncountypropertyappraiser.org/` // Manual Search Popup
  },
  'jefferson': {
    type: 'custom',
    urlBuilder: (id) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=866&LayerID=16381&PageTypeID=4&PageID=7228&KeyValue=${id}` 
  },
  'wakulla': {
    type: 'custom',
    urlBuilder: (id) => {
        // Format: 12-5S-03W-063-00794-000 (2-2-3-3-5-3)
        const cleanId = id.replace(/-/g, '').trim();
        if (cleanId.length === 18) {
            const p1 = cleanId.substring(0, 2);
            const p2 = cleanId.substring(2, 4);
            const p3 = cleanId.substring(4, 7);
            const p4 = cleanId.substring(7, 10);
            const p5 = cleanId.substring(10, 15);
            const p6 = cleanId.substring(15);
            const formatted = `${p1}-${p2}-${p3}-${p4}-${p5}-${p6}`;
            return `https://qpublic.schneidercorp.com/Application.aspx?AppID=836&LayerID=15205&PageTypeID=4&PageID=6833&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=836&LayerID=15205&PageTypeID=4&PageID=6833&KeyValue=${id}`;
    }
  },
  'leon': {
    type: 'custom',
    urlBuilder: (id) => `https://search.leonpa.gov/Property/Details/${encodeURIComponent(id)}` 
  },
  'franklin': {
    type: 'custom',
    urlBuilder: (id) => `https://franklin-search.gsacorp.io/` 
  },
  'liberty': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB: 0061S5W00083024 (15 chars)
        // URL: 006-1S-5W-00083-024
        const match = id.match(/^(\d{3})(.{2})(.{2})(\d{5})(\d{3})$/);
        if (match) {
            const [_, sec, twn, rng, block, lot] = match;
            const formatted = `${sec}-${twn}-${rng}-${block}-${lot}`;
            return `https://qpublic.schneidercorp.com/Application.aspx?AppID=828&LayerID=15003&PageTypeID=4&PageID=13690&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=828&LayerID=15003&PageTypeID=4&PageID=13690&KeyValue=${id}`;
    }
  },
  'gulf': {
    type: 'custom',
    urlBuilder: (id) => `https://gulf.matt.cama.io/parcel/${id}` 
  },
  'calhoun': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB Format: 223S10000000040000 (18 chars)
        // Link Format: 11-1N-11-0560-0007-1600 (SS-TT-RR-SUBB-BLKK-LOTT)
        if (id && id.length === 18) {
            const sec = id.substring(0, 2);
            const twn = id.substring(2, 4);
            const rng = id.substring(4, 6);
            const sub = id.substring(6, 10);
            const blk = id.substring(10, 14);
            const lot = id.substring(14, 18);
            const formatted = `${sec}-${twn}-${rng}-${sub}-${blk}-${lot}`;
            return `https://beacon.schneidercorp.com/Application.aspx?AppID=829&LayerID=15004&PageTypeID=4&PageID=6750&KeyValue=${formatted}`;
        }
        return `https://beacon.schneidercorp.com/Application.aspx?AppID=829&LayerID=15004&PageTypeID=4&PageID=6750&KeyValue=${id}`;
    }
  },
  'gadsden': {
    type: 'custom',
    urlBuilder: (id) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=814&LayerID=14537&PageTypeID=4&PageID=6817&KeyValue=${id}` 
  },
  'jackson': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB Format: 034N10000004100000 (18 chars)
        // Link Format: 02-4N-10-0000-0040-0030 (SS-TT-RR-SUBB-BLKK-LOTT)
        // User provided: https://qpublic.schneidercorp.com/Application.aspx?AppID=851&LayerID=15884&PageTypeID=4&PageID=13353&Q=1987531539&KeyValue=02-4N-10-0000-0040-0030
        if (id && id.length === 18) {
            const sec = id.substring(0, 2);
            const twn = id.substring(2, 4);
            const rng = id.substring(4, 6);
            const sub = id.substring(6, 10);
            const blk = id.substring(10, 14);
            const lot = id.substring(14, 18);
            const formatted = `${sec}-${twn}-${rng}-${sub}-${blk}-${lot}`;
            return `https://qpublic.schneidercorp.com/Application.aspx?AppID=851&LayerID=15884&PageTypeID=4&PageID=13353&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=851&LayerID=15884&PageTypeID=4&PageID=13353&KeyValue=${id}`;
    }
  },
  'bay': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB Format: 03030050000 (11 chars)
        // Link Format: 17585-010-000 (XXXXX-XXX-XXX)
        // User provided: https://qpublic.schneidercorp.com/application.aspx?AppID=834&LayerID=15170&PageTypeID=4&PageID=6825&Q=1720342773&KeyValue=17585-010-000
        if (id && id.length === 11) {
            const part1 = id.substring(0, 5);
            const part2 = id.substring(5, 8);
            const part3 = id.substring(8, 11);
            const formatted = `${part1}-${part2}-${part3}`;
            return `https://qpublic.schneidercorp.com/application.aspx?AppID=834&LayerID=15170&PageTypeID=4&PageID=6825&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/application.aspx?AppID=834&LayerID=15170&PageTypeID=4&PageID=6825&KeyValue=${id}`;
    }
  },
  'escambia': {
    type: 'custom',
    urlBuilder: (id) => `https://www.escpa.org/CAMA/Detail_a.aspx?s=${id}`
  },
  'holmes': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB: 043200000000002200 (18 digits)
        // User: 0432.00-000-000-002.200
        if (id && id.length === 18) {
             const formatted = `${id.substring(0,4)}.${id.substring(4,6)}-${id.substring(6,9)}-${id.substring(9,12)}-${id.substring(12,15)}.${id.substring(15,18)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=821&LayerID=14700&PageTypeID=4&PageID=6567&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=821&LayerID=14700&PageTypeID=4&PageID=6567&KeyValue=${id}`;
    }
  },
  'washington': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB: 000000001910750013 (18 digits)
        // User: 00000000-00-3430-0001
        // Format: AAAAAAAA-BB-CCCC-DDDD
        if (id && id.length === 18) {
             const formatted = `${id.substring(0,8)}-${id.substring(8,10)}-${id.substring(10,14)}-${id.substring(14,18)}`;
             return `https://qpublic.schneidercorp.com/Application.aspx?AppID=896&LayerID=16944&PageTypeID=4&PageID=7615&KeyValue=${formatted}`;
        }
        return `https://qpublic.schneidercorp.com/Application.aspx?AppID=896&LayerID=16944&PageTypeID=4&PageID=7615&KeyValue=${id}`;
    }
  },
  'walton': {
    type: 'custom',
    urlBuilder: (id) => {
        // DB: 363S18161200000170 (18 digits)
        // User: 24-3S-19-25900-000-0103
        // Format: XX-XX-XX-XXXXX-XXX-XXXX
        if (id && id.length === 18) {
             const formatted = `${id.substring(0,2)}-${id.substring(2,4)}-${id.substring(4,6)}-${id.substring(6,11)}-${id.substring(11,14)}-${id.substring(14,18)}`;
             return `https://beacon.schneidercorp.com/Application.aspx?AppID=835&LayerID=15172&PageTypeID=4&PageID=6829&KeyValue=${formatted}`;
        }
        return `https://beacon.schneidercorp.com/Application.aspx?AppID=835&LayerID=15172&PageTypeID=4&PageID=6829&KeyValue=${id}`;
    }
  },
};

export const getPropertyAppraiserUrl = (county: string, parcelId: string, altId?: string): string | null => {
  if (!county || !parcelId) return null;
  const c = county.trim().toLowerCase();
  const config = COUNTY_CONFIGS[c];
  
  if (!config) return null;

  if (config.type === 'custom') {
    return config.urlBuilder(parcelId, altId);
  }

  if (config.type === 'schneider') {
    // qPublic Pattern
    const key = config.useAltId && altId ? altId : parcelId;
    return `https://qpublic.schneidercorp.com/Application.aspx?AppID=${config.appId}&LayerID=${config.layerId}&PageTypeID=4&PageID=${config.pageId}&KeyValue=${key}`;
  }

  return null;
};
