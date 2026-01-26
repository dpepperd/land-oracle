type CountyConfig = 
  | { type: 'schneider'; appId: string; layerId: string; pageId: string }
  | { type: 'custom'; urlBuilder: (id: string) => string };

const COUNTY_CONFIGS: Record<string, CountyConfig> = {
  'baker': {
    type: 'custom',
    urlBuilder: (id) => {
      // Baker removes dashes/spaces for its PHP search
      const clean = id.replace(/[^a-zA-Z0-9]/g, '');
      return `https://bakerpa.com/propertydetails.php?parcel=${clean}`;
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
  'putnam': {
    type: 'custom',
    urlBuilder: (id) => 'https://pamap.putnam-fl.gov/PropertyAppraiserPublicMap/' // Manual Search Required
  }

};

export const getPropertyAppraiserUrl = (county: string, parcelId: string): string | null => {
  if (!county || !parcelId) return null;
  const c = county.trim().toLowerCase();
  const config = COUNTY_CONFIGS[c];
  
  if (!config) return null;

  if (config.type === 'custom') {
    return config.urlBuilder(parcelId);
  }

  if (config.type === 'schneider') {
    // qPublic Pattern
    return `https://qpublic.schneidercorp.com/Application.aspx?AppID=${config.appId}&LayerID=${config.layerId}&PageTypeID=4&PageID=${config.pageId}&KeyValue=${parcelId}`;
  }

  return null;
};
