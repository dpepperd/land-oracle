type CountyConfig = 
  | { type: 'schneider'; appId: string; layerId: string; pageId: string; useAltId?: boolean }
  | { type: 'custom'; urlBuilder: (id: string, altId?: string) => string };

const COUNTY_CONFIGS: Record<string, CountyConfig> = {
  'baker': {
    type: 'custom',
    urlBuilder: (id) => {
      // Baker removes dashes/spaces for its PHP search
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      return `https://bakerpa.com/propertydetails.php?parcel=${clean}`;
    }
  },
  'polk': {
    type: 'custom',
    urlBuilder: (id) => 'https://www.polkflpa.gov/CamaSearch.aspx' // Polk - Auto-copies ID (Manual Search)
  },
  'indian river': {
    type: 'schneider',
    appId: '1109',
    layerId: '27655',
    pageId: '11279'
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
  }

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
