"use client";

import { useEffect, useState, useMemo } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, Layers, Map as MapIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { COUNTY_REGIONS, REGION_COLORS, REGION_LABELS, RegionKey } from '@/lib/regions';

const FL_GEOJSON = "https://raw.githubusercontent.com/danielcs88/fl_geo_json/master/geojson-fl-counties-fips.json";

type ViewMode = 'live' | 'regions';

export default function CoverageMap() {
  const { theme } = useTheme();
  const [liveCounties, setLiveCounties] = useState<string[]>([]);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('live');

  // Fetch Live Status
  useEffect(() => {
    fetch('/api/user/counties')
      .then(res => res.json())
      .then(data => {
        if (data.liveCounties) {
           // Normalize names to match GeoJSON "NAME" property (e.g. "St. Johns")
           const normalized = data.liveCounties.map((c: string) => {
              if (c.toLowerCase() === 'st johns' || c.toLowerCase() === 'saint johns') return 'St. Johns';
              if (c.toLowerCase() === 'st lucie' || c.toLowerCase() === 'saint lucie') return 'St. Lucie';
              if (c.toLowerCase() === 'desoto') return 'DeSoto';
              return c; 
           });
           setLiveCounties(normalized);
        }
      })
      .catch(err => console.error("Failed to fetch coverage", err))
      .finally(() => setLoading(false));
  }, []);

  // Compute Fill Layer paint logic
  const fillLayer: any = useMemo(() => {
    let fillColorExpression: any[];

    if (viewMode === 'live') {
      fillColorExpression = [
        'case',
        ['in', ['get', 'NAME'], ['literal', liveCounties]],
        '#22c55e', // Green for Live
        '#94a3b8'  // Slate-400 for Offline
      ];
    } else {
      // Regions Mode
      // Match expression: ['match', ['get', 'NAME'], 'County1', 'Color1', 'County2', 'Color2', ... 'DefaultColor']
      const matchArgs: any[] = ['match', ['get', 'NAME']];
      
      Object.entries(COUNTY_REGIONS).forEach(([county, region]) => {
        matchArgs.push(county);
        matchArgs.push(REGION_COLORS[region]);
      });
      
      // Default fallback (Gray)
      matchArgs.push('#94a3b8');
      
      fillColorExpression = matchArgs;
    }

    return {
      id: 'counties-fill',
      type: 'fill',
      paint: {
        'fill-color': fillColorExpression,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.8,
          0.5
        ],
        'fill-outline-color': '#ffffff'
      }
    };
  }, [liveCounties, viewMode]);

  const onHover = (event: any) => {
    const feature = event.features && event.features[0];
    const countyName = feature?.properties?.NAME;
    const regionKey = countyName ? COUNTY_REGIONS[countyName] : null;
    
    setHoverInfo({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat,
      countyName: countyName,
      isLive: feature && liveCounties.includes(countyName),
      region: regionKey ? REGION_LABELS[regionKey] : null
    });
  };

  return (
    <div className="w-full h-full relative group font-sans">
      <Map
        initialViewState={{
             longitude: -81.5158,
             latitude: 27.6648,
             zoom: 5.5
        }}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle={theme === 'dark' ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
        interactiveLayerIds={['counties-fill']}
        onMouseMove={onHover}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <NavigationControl position="top-right" />
        
        <Source id="fl-counties" type="geojson" data={FL_GEOJSON}>
          <Layer {...fillLayer} />
          {/* Borders */}
          <Layer
            id="counties-line"
            type="line"
            paint={{
              'line-color': '#ffffff',
              'line-width': 1,
              'line-opacity': 0.3
            }}
          />
        </Source>

        {hoverInfo && hoverInfo.countyName && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            offset={0}
            closeButton={false}
            closeOnClick={false}
            className="text-black"
          >
            <div className="text-sm font-semibold text-slate-900">
              {hoverInfo.countyName} County
            </div>
            {viewMode === 'live' ? (
                <div className={`text-xs ${hoverInfo.isLive ? 'text-green-600 font-bold' : 'text-slate-500'}`}>
                {hoverInfo.isLive ? "● Live Data" : "Coming Soon"}
                </div>
            ) : (
                <div className="text-xs text-slate-600 font-medium">
                    {hoverInfo.region}
                </div>
            )}
          </Popup>
        )}
      </Map>

      {/* View Mode Toggle */}
      <div className="absolute top-4 left-4 bg-white dark:bg-slate-900 p-1 rounded-lg shadow-md border border-zinc-200 dark:border-slate-800 flex gap-1">
        <button
            onClick={() => setViewMode('live')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'live' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
            <MapIcon className="w-4 h-4" />
            Live Map
        </button>
        <button
            onClick={() => setViewMode('regions')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'regions' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
            <Layers className="w-4 h-4" />
            Regions
        </button>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 p-3 rounded-lg text-xs shadow-md border border-zinc-200 dark:border-slate-800 backdrop-blur-sm min-w-[140px]">
        {viewMode === 'live' ? (
            <>
                <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm opacity-50 border border-white/20"></div>
                <span className="text-foreground font-medium">Live Coverage</span>
                </div>
                <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-400 rounded-sm opacity-50 border border-white/20"></div>
                <span className="text-[var(--text-secondary)]">Planned</span>
                </div>
            </>
        ) : (
            <div className="flex flex-col gap-2">
                <div className="font-semibold text-foreground mb-1">Florida Regions</div>
                {Object.entries(REGION_COLORS).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm opacity-60 border border-white/20" style={{ backgroundColor: color }}></div>
                        <span className="text-foreground capitalize">{REGION_LABELS[key as RegionKey]}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
