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
