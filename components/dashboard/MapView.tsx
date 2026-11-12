'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Map, { 
  Source, 
  Layer, 
  NavigationControl, 
  Popup, 
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  MapRef
} from 'react-map-gl/mapbox';
import { Layers, X, Ruler, Edit2, CheckCircle2, ScanSearch, Eye, EyeOff, Database, Droplets } from 'lucide-react';


import ConfirmModal from './ConfirmModal';
import GeocoderControl from './GeocoderControl';
import { getPropertyAppraiserUrl } from '@/lib/countyLinks';
import { useTheme } from 'next-themes';
import { floodLabel, FLOOD_TONE_CLASS } from '@/lib/floodLabel';
import { useFlood, requestFlood } from '@/lib/floodClient';
import * as turf from 'turf';
import 'mapbox-gl/dist/mapbox-gl.css';

// Traffic Styles
const trafficLayer: any = {
  id: 'traffic-lines',
  type: 'line',
  paint: {
    'line-width': 3,
    'line-color': ['get', 'color'],
    'line-opacity': 0.8
  }
};

const truckLayer: any = {
  id: 'truck-lines',
  type: 'line',
  paint: {
    'line-width': 3,
    'line-color': ['get', 'truck_color'],
    'line-opacity': 0.8
  }
};

// One list drives both the map colors and the legend, so they can never disagree.
const FLOOD_LEGEND: { label: string; detail: string; zones: string[]; color: string }[] = [
  { label: 'High risk', detail: 'Zones A, AE, AH, AO', zones: ['A', 'AE', 'AH', 'AO', 'AR', 'A99'], color: '#60a5fa' },
  { label: 'High risk, coastal waves', detail: 'Zone VE', zones: ['VE', 'V'], color: '#1e40af' },
  { label: 'Lower risk', detail: 'Zone X (0.2% or minimal)', zones: ['X', 'x', '0.2 PCT ANNUAL CHANCE FLOOD HAZARD'], color: '#9ca3af' },
  { label: 'Undetermined', detail: 'Zone D', zones: ['D'], color: '#f59e0b' },
  { label: 'Open water', detail: 'No flood zone assigned', zones: ['OPEN WATER'], color: '#cbd5e1' },
];

const floodLayer: any = {
  id: 'flood-zones',
  type: 'fill',
  paint: {
    'fill-color': [
      'match',
      ['get', 'fld_zone'],
      ...FLOOD_LEGEND.flatMap((l) => [l.zones, l.color]),
      '#cbd5e1' // any zone we do not recognize: neutral, never "high risk"
    ],
    'fill-opacity': 0.4
  }
};

// Map Styles
const MAP_STYLES = {
  streets: { label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  dark: { label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  outdoors: { label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  usgs: { label: 'USGS Topo', url: 'mapbox://styles/mapbox/light-v11', usgs: true }
};

interface MapViewProps {
  geojson: any;
  popupInfo: any | null;
  setPopupInfo: (info: any | null) => void;
  isLoading: boolean;
  userRole?: string;
  userTier?: string;
  onUpsell?: () => void;
  onSearchArea?: (bounds: number[], shape?: any) => void;
  /** Increments when the sidebar's Clear All / Reset cleared the search area: drop the drawn outline too. */
  clearShapeSignal?: number;
}

// Layer Styles
const clusterLayer: any = {
  id: 'clusters',
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
  }
};

const clusterCountLayer: any = {
  id: 'cluster-count',
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12
  }
};

// Parcels are tiny at county/state zoom, so also draw each result as a dot until you zoom in (polygons take over at zoom 12+).
const parcelDotLayer: any = {
  id: 'parcel-dots',
  type: 'circle',
  maxzoom: 12,
  paint: {
    'circle-color': ['case', ['boolean', ['get', 'out_of_state'], false], '#ef4444', '#a855f7'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 11, 5],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9
  }
};

const unclusteredPointLayer: any = {
  id: 'unclustered-point',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#ef4444', 
        '#d8b4fe'  // Light Purple (was Orange)
    ],
    'circle-radius': [
        'case',
        ['==', ['geometry-type'], 'Point'],
        6, 
        0  
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff'
  }
};

const parcelFillLayer: any = {
  id: 'parcel-fill',
  type: 'fill',
  paint: {
    'fill-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#ef4444', 
        '#d8b4fe' // Light Purple
    ],
    'fill-opacity': 0.4
  }
};

const parcelLineLayer: any = {
  id: 'parcel-line',
  type: 'line',
  paint: {
    'line-color': [
        'case',
        ['boolean', ['get', 'out_of_state'], false],
        '#b91c1c', 
        '#a855f7' // Darker Purple Border
    ],
    'line-width': 1
  }
};

const highwayLayer: any = {
  id: 'highway-line',
  type: 'line',
  paint: {
    'line-color': '#f97316', // Orange-500
    'line-width': 2,
    'line-opacity': 0.8
  }
};

const measureLineLayer: any = {
    id: 'measure-line',
    type: 'line',
    paint: {
        'line-color': '#06b6d4', // Cyan-500
        'line-width': 3,
        'line-dasharray': [2, 1]
    }
};

const measurePointLayer: any = {
    id: 'measure-points',
    type: 'circle',
    paint: {
        'circle-radius': 5,
        'circle-color': '#06b6d4',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
    }
};

const FL_GEOJSON = "https://raw.githubusercontent.com/danielcs88/fl_geo_json/master/geojson-fl-counties-fips.json";

export default function MapView({ 
  geojson, 
  popupInfo, 
  setPopupInfo, 
  isLoading, 
  userRole = 'user',
  userTier = 'demo',
  onUpsell,
  onSearchArea,
  clearShapeSignal = 0
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useTheme();
  const [activeStyle, setActiveStyle] = useState<string>('outdoors');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  
  // Traffic State (New)
  const [showTraffic, setShowTraffic] = useState(false);
  const [showTrucks, setShowTrucks] = useState(false); // New
  const [trafficData, setTrafficData] = useState<any>({ type: 'FeatureCollection', features: [] });
  
  // Flood Layer State
  const [showFlood, setShowFlood] = useState(false);
  // FEMA flood zone for the open parcel popup (live FEMA lookup, cached)
  const popupKey: string | undefined = popupInfo?.properties?.parcel_key;
  const popupFlood = useFlood(popupKey);
  useEffect(() => {
    const pr = popupInfo?.properties;
    if (pr?.parcel_key) requestFlood(pr.parcel_key, pr.flood_lat ?? pr.latitude, pr.flood_lon ?? pr.longitude);
  }, [popupInfo]);
  const [floodData, setFloodData] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [floodZoomIn, setFloodZoomIn] = useState(false); // true when the view is too wide for flood data
  
  const [dataLayersOpen, setDataLayersOpen] = useState(false);

  const fetchTraffic = async (bounds: number[]) => {
      if (!showTraffic && !showTrucks) return;
      try {
          const [minLng, minLat, maxLng, maxLat] = bounds;
          const query = new URLSearchParams({
              minLat: minLat.toString(),
              maxLat: maxLat.toString(),
              minLon: minLng.toString(),
              maxLon: maxLng.toString()
          });
          const res = await fetch(`/api/layers/traffic?${query}`);
          const data = await res.json();
          setTrafficData(data);
      } catch (e) {
          console.error("Traffic fetch failed", e);
      }
  };

  const fetchFlood = async (bounds: number[]) => {
      if (!showFlood) return;
      try {
          const [minLng, minLat, maxLng, maxLat] = bounds;
          // Server refuses views wider than 3 degrees; tell the user instead of showing nothing
          if (maxLat - minLat > 3 || maxLng - minLng > 3) {
              setFloodZoomIn(true);
              setFloodData({ type: 'FeatureCollection', features: [] });
              return;
          }
          setFloodZoomIn(false);
          const query = new URLSearchParams({
              minLat: minLat.toString(),
              maxLat: maxLat.toString(),
              minLon: minLng.toString(),
              maxLon: maxLng.toString()
          });
          const res = await fetch(`/api/map/flood?${query}`);
          if (!res.ok) {
              // Zoomed out too far (400) or server error: show nothing rather than an error body
              setFloodData({ type: 'FeatureCollection', features: [] });
              return;
          }
          const data = await res.json();
          setFloodData(data);
      } catch (e) {
          console.error("Flood fetch failed", e);
      }
  };

  useEffect(() => {
    if ((showTraffic || showTrucks) && mapRef.current) {
         const bounds = mapRef.current.getBounds();
         if (bounds) {
             fetchTraffic(bounds.toArray().flat());
         }
    }
  }, [showTraffic, showTrucks]);

  useEffect(() => {
    if (showFlood && mapRef.current) {
         const bounds = mapRef.current.getBounds();
         if (bounds) fetchFlood(bounds.toArray().flat());
    }
  }, [showFlood]);
  
  // Debounce fetch on move
  const onMoveEnd = (e: any) => {
      const bounds = e.target.getBounds().toArray().flat();
      if (showTraffic || showTrucks) {
          fetchTraffic(bounds);
      }
      if (showFlood) {
          fetchFlood(bounds);
      }
  };
  const [highways, setHighways] = useState<any>(null);
  const [showHighways, setShowHighways] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true); // Default ON
  const [scaleUnit, setScaleUnit] = useState<'imperial' | 'metric'>('imperial'); // Default to MILES
  
  // Measure Tool State
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<any[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);

  // Drawing Tool State (Spatial Search)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<any[]>([]);
  useEffect(() => { if (clearShapeSignal > 0) { setDrawPoints([]); setIsDrawing(false); } }, [clearShapeSignal]);
  const [isShapeVisible, setIsShapeVisible] = useState(true);

  // Admin Edit State

  // External Link State
  // External Link State
  // One dot per result (from each parcel's own coordinates) so results stay visible when zoomed out.
  const dotsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: ((geojson && geojson.features) || [])
      .filter((f: any) => f && f.properties && Number.isFinite(Number(f.properties.flood_lon ?? f.properties.longitude)) && Number.isFinite(Number(f.properties.flood_lat ?? f.properties.latitude)))
      .map((f: any) => ({
        type: 'Feature' as const,
        properties: f.properties,
        geometry: { type: 'Point' as const, coordinates: [Number(f.properties.flood_lon ?? f.properties.longitude), Number(f.properties.flood_lat ?? f.properties.latitude)] },
      })),
  }), [geojson]);

  const [externalLink, setExternalLink] = useState<{ url: string; county: string; id?: string; landUse?: string } | null>(null);

  // Auto-zoom to Results
  useEffect(() => {
    console.log("[MapView] GeoJSON Update:", geojson?.features?.length, "features");
    if (!geojson || !geojson.features || geojson.features.length === 0) return;
    if (!mapRef.current) {
        console.log("[MapView] Map ref is null");
        return;
    }

    try {
        console.log("[MapView] Calculating BBox...");
        
        // FIX: Sanitize features for turf.bbox coverage (crashes on null geometry)
        const validFeatures = geojson.features.filter((f: any) => f && f.geometry);
        
        if (validFeatures.length === 0) return;
        
        const cleanGeojson = {
            ...geojson,
            features: validFeatures
        };

        const bbox = turf.bbox(cleanGeojson) as [number, number, number, number];
        console.log("[MapView] BBox:", bbox);
        
        if (bbox && bbox.some(c => !isNaN(c) && isFinite(c))) {
            console.log("[MapView] fitting bounds...");
            mapRef.current.fitBounds(
                [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
                { padding: 50, duration: 2000, maxZoom: 17 } // Smooth zoom
            );
        } else {
             console.log("[MapView] BBox is invalid");
        }
    } catch (e) {
        console.error("Failed to fit bounds:", e);
    }
  }, [geojson]);

  // Notes logic moved to CRMPanel
  // Only minimal popup logic remains here
  
  // Handle Save (Keep for Admin Edit Modal if needed, or move to Panel?)
  // For now keeping Admin Edit Modal logic here as it's separate from Notes.

  // Fetch Highways once on mount
  useEffect(() => {
    fetch('/api/highways')
      .then(res => res.json())
      .then(data => setHighways(data))
      .catch(err => console.error("Failed to load highways", err));
  }, []);
  
  // Sync Map Style with Theme
  useEffect(() => {
    const isThemeable = activeStyle === 'streets' || activeStyle === 'dark';
    if (isThemeable) {
      if (theme === 'dark') {
        setActiveStyle('dark');
      } else {
        setActiveStyle('streets');
      }
    }
  }, [theme]);
  
  // Fly to Popup Location when it changes
  useEffect(() => {
    if (popupInfo && popupInfo.start_lat && popupInfo.start_lng) {
      mapRef.current?.flyTo({
        center: [popupInfo.start_lng, popupInfo.start_lat],
        zoom: 16,
        duration: 1500
      });
    }
  }, [popupInfo]);
  
  // FIX: Helper function to properly format bbox for API
  // turf.bbox returns [minLon, minLat, maxLon, maxLat] (GeoJSON standard)
  // API expects [minLat, maxLat, minLon, maxLon]
  const formatBboxForApi = (bbox: number[]): number[] => {
    // bbox from turf: [west/minLon, south/minLat, east/maxLon, north/maxLat]
    //                 [bbox[0],     bbox[1],      bbox[2],     bbox[3]]
    // API expects:    [minLat,      maxLat,       minLon,      maxLon]
    return [bbox[1], bbox[3], bbox[0], bbox[2]];
  };

  const initialViewState = {
    latitude: 27.6648,
    longitude: -81.5158,
    zoom: 6
  };

  return (
    <div className="w-full h-full relative group map-container">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLES[activeStyle as keyof typeof MAP_STYLES].url}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        interactiveLayerIds={['clusters', 'parcel-fill', 'unclustered-point', 'parcel-dots']}
        onMoveEnd={onMoveEnd}
        onClick={(event) => {
            if (isDrawing) {
                const newPoint = [event.lngLat.lng, event.lngLat.lat];
                setDrawPoints(prev => [...prev, newPoint]);
                return;
            }

            if (isMeasureMode) {
                const newPoints = [...measurePoints, [event.lngLat.lng, event.lngLat.lat]];
                if (newPoints.length > 2) {
                    setMeasurePoints([[event.lngLat.lng, event.lngLat.lat]]);
                    setMeasureDistance(null);
                } else {
                    setMeasurePoints(newPoints);
                    if (newPoints.length === 2) {
                        const from = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: newPoints[0] } };
                        const to = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: newPoints[1] } };
                        try {
                            const dist = turf.distance(from, to, 'miles');
                            setMeasureDistance(dist);
                        } catch(e) { console.error(e); }
                    } else {
                        setMeasureDistance(null);
                    }
                }
                return;
            }

            const feature = event.features?.[0];
            if (feature?.layer?.id === 'parcel-fill' || feature?.layer?.id === 'unclustered-point' || feature?.layer?.id === 'parcel-dots') {
                setPopupInfo({
                    start_lat: event.lngLat.lat,
                    start_lng: event.lngLat.lng,
                    properties: feature.properties
                });
            } else {
                 if (!feature) setPopupInfo(null);
            }
        }}
        onMouseMove={(event) => {
             if (isMeasureMode || isDrawing) {
                 mapRef.current?.getCanvas().style.setProperty('cursor', 'crosshair');
             }
        }}
        onMouseEnter={() => mapRef.current?.getCanvas().style.setProperty('cursor', 'pointer')}
        onMouseLeave={() => mapRef.current?.getCanvas().style.setProperty('cursor', '')}
      >
        <GeolocateControl position="top-right" />
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" />
        <ScaleControl unit={scaleUnit} />
        
        {/* MAPBOX GEOCODER COMPONENT */}
        <GeocoderControl mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string} position="top-left" marker={false} />

         {activeStyle === 'usgs' && (
            <Source
              id="usgs-topo"
              type="raster"
              tiles={['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}']}
              tileSize={256}
              attribution="USGS"
            >
              <Layer id="usgs-topo-layer" type="raster" />
            </Source>
         )}

         {highways && showHighways && (
            <Source id="highways" type="geojson" data={highways}>
                <Layer {...highwayLayer} />
            </Source>
         )}

         {/* Custom Drawing Layer */}
         {drawPoints.length > 0 && isShapeVisible && (
             <Source 
               id="draw-source"
               type="geojson"
               data={{
                   type: 'FeatureCollection',
                   features: [
                       {
                           type: 'Feature',
                           properties: {},
                           geometry: {
                               type: 'Polygon',
                               coordinates: [[...drawPoints, drawPoints[0]]] // Correctly close ring
                           }
                       },
                       {
                           type: 'Feature',
                           properties: {},
                           geometry: {
                               type: 'LineString',
                               coordinates: [...drawPoints, drawPoints[0]] // Outline
                           }
                       },
                       // Only show points while drawing or editing
                       ...(isDrawing ? drawPoints.map(pt => ({
                           type: 'Feature',
                           properties: {},
                           geometry: { type: 'Point', coordinates: pt }
                       })) : [])
                   ] as any
               }}
             >
                 <Layer 
                    id="draw-fill"
                    type="fill"
                    paint={{
                        'fill-color': '#3b82f6', // Blue-500 (Clean modern blue)
                        'fill-opacity': 0.15 // Subtler
                    }}
                 />
                 <Layer 
                    id="draw-line"
                    type="line"
                    paint={{
                        'line-color': '#2563eb', // Blue-600
                        'line-width': 2
                    }}
                 />
                 {isDrawing && (
                    <Layer 
                        id="draw-points"
                        type="circle"
                        paint={{
                            'circle-radius': 5,
                            'circle-color': '#ffffff',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#2563eb'
                        }}
                    />
                 )}
             </Source>
         )}

         {measurePoints.length > 0 && (
             <Source 
               id="measure-source"
               type="geojson"
               data={{
                   type: 'FeatureCollection',
                   features: [
                       {
                           type: 'Feature' as const,
                           properties: {},
                           geometry: {
                               type: 'LineString',
                               coordinates: measurePoints
                           }
                       },
                       ...measurePoints.map(pt => ({
                           type: 'Feature' as const,
                           properties: {},
                           geometry: { type: 'Point' as const, coordinates: pt }
                       }))
                   ]
               }}
             >
                 <Layer {...measureLineLayer} />
                 <Layer {...measurePointLayer} />
             </Source>
         )}

        <Source
          id="parcels"
          type="geojson"
          data={geojson}
          cluster={false}
        >
          <Layer {...parcelFillLayer} />
          <Layer {...parcelLineLayer} />
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        <Source id="parcel-dots-src" type="geojson" data={dotsGeojson}>
          <Layer {...parcelDotLayer} />
        </Source>

        {showBoundaries && (
            <Source
                id="fl-counties"
                type="geojson"
                data={FL_GEOJSON}
            >
                <Layer 
                    id="county-boundary-line"
                    type="line"
                    paint={{
                        'line-color': '#000000', // Black
                        'line-width': 1,
                        'line-opacity': 0.8,
                    }}
                />
                <Layer
                    id="county-boundary-label"
                    type="symbol"
                    minzoom={6.5}
                    layout={{
                        'text-field': ['get', 'NAME'],
                        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                        'text-size': 12,
                        'text-transform': 'uppercase',
                        'symbol-placement': 'point'
                    }}
                    paint={{
                        'text-color': '#ffffff', // White Text
                        'text-halo-color': '#000000', // Black Halo
                        'text-halo-width': 1.25, // Thin, crisp shadow
                        'text-opacity': 0.95
                    }}
                />
                 {/* Only labels at higher zooms? Or keep simple for now */}
            </Source>
        )}
        
        {popupInfo && (popupInfo.properties?.geojson || popupInfo.start_lat) && (
            <Source
                id="selected-parcel"
                type="geojson"
                data={popupInfo.properties.geojson || {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [popupInfo.start_lng, popupInfo.start_lat] }
                }}
            >
                <Layer 
                    id="highlight-line"
                    type="line"
                    paint={{
                        'line-color': '#fbbf24', // Amber
                        'line-width': 4,
                        'line-opacity': 1
                    }}
                />
            </Source>
        )}

        {popupInfo && (
           <Popup
           longitude={popupInfo.start_lng}
           latitude={popupInfo.start_lat}
           anchor="bottom"
           onClose={() => setPopupInfo(null)}
           closeButton={false}
           closeOnClick={false}
           className="z-50"
           maxWidth="320px"
         >
           <div className="p-1 min-w-[280px] relative">
             <button 
               onClick={(e) => {
                   e.stopPropagation();
                   setPopupInfo(null);
               }}
               className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-red-500 transition-colors z-20 cursor-pointer"
               title="Close"
             >
               <X size={20} strokeWidth={2.5} />
             </button>
             <h3 className="text-blue-600 font-semibold text-base mb-2 border-b border-gray-200 pb-1 pr-6">Parcel Info</h3>
             
             <div className="grid grid-cols-[100px_1fr] gap-y-1 text-xs text-gray-700 leading-tight">
               <span className="font-bold text-gray-900">County:</span>
               <span>{popupInfo.properties.county}</span>

               <span className="font-bold text-gray-900">Parcel ID:</span>
               <span>
                 {getPropertyAppraiserUrl(popupInfo.properties.county, popupInfo.properties.parcel_id) ? (
                   <button 
                     onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                            // Auto-copy ID
                            // Auto-copy ID
                            if (popupInfo.properties.parcel_id) {
                               let val = popupInfo.properties.parcel_id;
                               // Pinellas Search requires 01-30-14... (S-T-R) not 14-30-01... (R-T-S)
                               if (popupInfo.properties.county === 'Pinellas') {
                                   const p = val.trim().replace(/\s+/g, '-').split('-');
                                   if (p.length >= 3) val = `${p[2]}-${p[1]}-${p[0]}-${p.slice(3).join('-')}`;
                               }
                               // Pasco Fix: Strip prefix for clean copy
                               if (popupInfo.properties.county === 'Pasco') {
                                   val = val.replace(/^Pasco-/i, '');
                               }
                               // Citrus: User prefers Parcel ID over Alt Key
                               if (popupInfo.properties.county === 'Citrus') {
                                   val = popupInfo.properties.parcel_id;
                               }
                               
                               console.log(`[Debug] ${popupInfo.properties.county} ID:`, val);
                               navigator.clipboard.writeText(val).catch(() => {});
                               
                               const url = getPropertyAppraiserUrl(popupInfo.properties.county, popupInfo.properties.parcel_id);
                               if (url) setExternalLink({ url, county: popupInfo.properties.county, id: val, landUse: popupInfo.properties.land_use });
                            }
                     }}
                     className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 focus:outline-none"
                     title="ID Copied! View on County Appraiser Site"
                   >
                     {popupInfo.properties.county === 'Pinellas' 
                        ? (() => {
                            const p = popupInfo.properties.parcel_id.trim().replace(/\s+/g, '-').split('-');
                            if (p.length >= 3) return `${p[2]}-${p[1]}-${p[0]}-${p.slice(3).join('-')}`;
                            return popupInfo.properties.parcel_id.trim().replace(/\s+/g, '-');
                        })()
                        : popupInfo.properties.county === 'Pasco'
                        ? popupInfo.properties.parcel_id.replace(/^Pasco-/i, '')
                        : popupInfo.properties.parcel_id}
                     <span className="text-[10px] text-gray-500 font-normal no-underline">↗</span>
                   </button>
                 ) : (
                   popupInfo.properties.parcel_id
                 )}
               </span>
               
               <span className="font-bold text-gray-900">Acres:</span>
               <span>{Number(popupInfo.properties.acreage).toFixed(2)}</span>
               
               <span className="font-bold text-gray-900">Land Use:</span>
               <span>{popupInfo.properties.land_use || 'N/A'}</span>
               
               <span className="font-bold text-gray-900">Property Value:</span>
               <span>${Number(popupInfo.properties.market_value).toLocaleString()}</span>
             </div>

             {(() => {
               const fl = floodLabel(popupFlood);
               return fl ? (
                 <div className="mt-2">
                   <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${FLOOD_TONE_CLASS[fl.tone]}`}>{fl.text}</span>
                 </div>
               ) : null;
             })()}

             <div className="mt-3">
               <div className="font-bold text-gray-900 text-xs mb-0.5">Property Address:</div>
               <div className="text-gray-600 text-xs uppercase">
                   {popupInfo.properties.property_address || 'N/A'}
               </div>
             </div>

             {/* Recent qualified sales (DOR SDF, 2026 roll) */}
             <div className="mt-3">
               <div className="font-bold text-gray-900 text-xs mb-0.5">Recent Sales:</div>
               {[1, 2, 3].map((n) => {
                 const price = popupInfo.properties[`sale_prc${n}`];
                 const when = popupInfo.properties[`sale${n}_date`];
                 if (!price || !when) return null;
                 return (
                   <div key={n} className="text-gray-600 text-xs">
                     ${Number(price).toLocaleString()} <span className="text-gray-400">({new Date(when).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })})</span>
                   </div>
                 );
               })}
               {!popupInfo.properties.sale_prc1 && <div className="text-gray-400 text-xs">No qualified sale on record</div>}
             </div>

             <div className="mt-3">
               <div className="font-bold text-gray-900 text-xs mb-0.5 max-w-[250px] truncate">Owner: <span className="font-normal uppercase">{popupInfo.properties.owner_name}</span></div>
               <div className="font-bold text-gray-900 text-xs mb-0.5">Owner Address:</div>
               <div className="text-gray-600 text-xs uppercase">
                 {popupInfo.properties.owner_address}<br/>
                 {popupInfo.properties.owner_city}, {popupInfo.properties.owner_state} {popupInfo.properties.owner_zip}
               </div>
             </div>

              {/* Contact Info (Premium Blurring) */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                  <div className="font-bold text-gray-900 text-xs mb-1">Contact Info:</div>
                  
                  {/* Phone */}
                  <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Phone:</span>
                      {userRole === 'admin' || userTier === 'paid' ? (
                          <span className="font-mono">{popupInfo.properties.owner_phone || 'N/A'}</span>
                      ) : (
                           <span 
                             onClick={(e) => { e.stopPropagation(); if(onUpsell) onUpsell(); }}
                             className="font-mono text-transparent bg-gray-200 rounded px-1 cursor-pointer select-none blur-[2px] hover:bg-gray-300 transition-colors"
                             title="Upgrade to view"
                           >
                              (555) 000-0000
                           </span>
                      )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Email:</span>
                      {userRole === 'admin' || userTier === 'paid' ? (
                          <span className="font-mono">{popupInfo.properties.owner_email || 'N/A'}</span>
                      ) : (
                           <span 
                             onClick={(e) => { e.stopPropagation(); if(onUpsell) onUpsell(); }}
                             className="font-mono text-transparent bg-gray-200 rounded px-1 cursor-pointer select-none blur-[2px] hover:bg-gray-300 transition-colors"
                             title="Upgrade to view"
                           >
                              user@example.com
                           </span>
                      )}
                  </div>
              </div>

              {/* CRM Notes Section */}
              {/* CRM Notes Section */}
              {/* Notes Removed - See CRMPanel */}

              {/* Owner data comes from the DOR roll and is read-only. */}

           </div>
         </Popup>
        )}
        {/* Traffic Source */}
        {showTraffic && (
            <Source id="traffic-source" type="geojson" data={trafficData}>
                <Layer {...trafficLayer} />
            </Source>
        )}
        {showTrucks && (
            <Source id="truck-source" type="geojson" data={trafficData}>
                <Layer {...truckLayer} />
            </Source>
        )}
        {showFlood && (
            <Source id="flood-source" type="geojson" data={floodData}>
                <Layer {...floodLayer} />
            </Source>
        )}
      </Map>

      {/* Flood layer legend (only while the FEMA layer is on) */}
      {showFlood && (
        <div className="absolute bottom-24 md:bottom-8 left-4 z-10 max-w-[230px] rounded-lg bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-gray-700 shadow-lg p-3 text-xs text-gray-700 dark:text-gray-200">
          <div className="font-bold mb-1.5 flex items-center gap-1.5"><Droplets size={13} className="text-blue-500" />FEMA flood zones</div>
          <ul className="space-y-1">
            {FLOOD_LEGEND.map((l) => (
              <li key={l.label} className="flex items-start gap-2">
                <span className="mt-0.5 inline-block w-4 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ backgroundColor: l.color, opacity: 0.75 }} />
                <span><span className="font-medium">{l.label}</span><span className="block text-[10px] text-gray-500 dark:text-gray-400">{l.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
            {floodZoomIn ? 'Zoom in to a county to see zones. ' : ''}Research aid only, not a flood determination. Confirm with FEMA and your county.
          </p>
        </div>
      )}

      {/* Style Switcher & Layers */}
      <div className="absolute top-16 sm:top-20 left-4 z-10 flex flex-col gap-2">
        {/* Base Map Style */}
        <div className="relative">
          <button
            onClick={() => setStyleMenuOpen(!styleMenuOpen)}
            className="bg-white dark:bg-slate-800 p-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-2"
          >
            <Layers className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Map Style</span>
          </button>
          
          {styleMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden py-1 z-20">
               {Object.entries(MAP_STYLES).map(([key, style]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveStyle(key);
                    setStyleMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                    activeStyle === key
                      ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-slate-700/50' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Data Layers (Second Dropdown) */}
        <div className="relative">
            <button
                onClick={() => setDataLayersOpen(!dataLayersOpen)}
                className="bg-white dark:bg-slate-800 p-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-2"
            >
                <Database className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Data Layers</span>
            </button>

            {dataLayersOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden py-1 z-20">
                     <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-gray-700">
                        Map Overlays
                     </div>
                     
                     <label className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox"
                                checked={showBoundaries}
                                onChange={(e) => setShowBoundaries(e.target.checked)}
                                className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-200">County Boundaries</span>
                     </label>

                     <label className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                             <input 
                                type="checkbox"
                                checked={showHighways}
                                onChange={(e) => setShowHighways(e.target.checked)}
                                className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-200">Major Highways</span>
                     </label>

                      <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      <label className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                             <input 
                                type="checkbox"
                                checked={showTraffic}
                                onChange={(e) => setShowTraffic(e.target.checked)}
                                className="peer h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                             />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-700 dark:text-gray-200">Average Daily Traffic</span>
                            <span className="text-[10px] text-gray-400">Zoom in to view</span>
                        </div>
                     </label>

                     <label className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                             <input 
                                type="checkbox"
                                checked={showTrucks}
                                onChange={(e) => setShowTrucks(e.target.checked)}
                                className="peer h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
                             />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-700 dark:text-gray-200">Truck Volume</span>
                            <span className="text-[10px] text-gray-400">Zoom in to view</span>
                        </div>
                     </label>

                      <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      <label className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                             <input 
                                type="checkbox"
                                checked={showFlood}
                                onChange={(e) => setShowFlood(e.target.checked)}
                                className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                             />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1.5 font-medium">
                                <Droplets size={14} className="text-blue-500"/>
                                FEMA Flood Zones
                            </span>
                            {showFlood && floodZoomIn ? (
                                <span className="text-[10px] text-amber-600 font-medium">Zoom in to a county to see flood zones</span>
                            ) : (
                                <span className="text-[10px] text-gray-400">DFIRM Layer</span>
                            )}
                        </div>
                     </label>
                </div>
            )}
        </div>
      </div>
      
         {/* Spatial Search Controls */}
       <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex gap-2 w-full justify-center pointer-events-none">
          {/* Container needs pointer-events-auto for children */}
          
          {/* IDLE STATE */}
          {!isDrawing && drawPoints.length === 0 && (
              <div className="pointer-events-auto flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                 <button
                     onClick={() => {
                         setIsDrawing(true);
                         setDrawPoints([]); // Reset
                     }}
                     className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all text-blue-600 dark:text-blue-400 font-bold text-sm"
                     title="Draw a custom search area on the map"
                 >
                     <Edit2 className="w-4 h-4" />
                     <span>DRAW SEARCH AREA</span>
                 </button>
              </div>
          )}

          {/* DRAWING STATE */}
          {isDrawing && (
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                       <button
                          onClick={() => {
                              // Finish Drawing POLYGON
                              if (drawPoints.length >= 3) {
                                  const polygon = {
                                      type: 'Feature',
                                      geometry: {
                                          type: 'Polygon',
                                          coordinates: [[...drawPoints, drawPoints[0]]]
                                      }
                                  };
                                  
                                  try {
                                      // @ts-ignore
                                      const bbox = turf.bbox(polygon);
                                      if (onSearchArea) {
                                          onSearchArea([bbox[1], bbox[3], bbox[0], bbox[2]], polygon);
                                      }
                                  } catch (e) {
                                      console.error('Error calculating bbox', e);
                                  }
                                  setIsDrawing(false);
                              } else {
                                  alert("Please click at least 3 points on the map to define an area.");
                              }
                          }}
                          className={`flex items-center gap-2 px-6 py-2 rounded-full shadow-xl transition-all font-bold text-sm animate-in fade-in zoom-in duration-200 ${
                              drawPoints.length >= 3 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-500/30 scale-105' 
                              : 'bg-gray-400 text-white cursor-not-allowed'
                          }`}
                          disabled={drawPoints.length < 3}
                       >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>APPLY SEARCH AREA</span>
                       </button>
                       
                       <button
                          onClick={() => {
                              setIsDrawing(false);
                              setDrawPoints([]);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-500 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-semibold text-sm"
                       >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                       </button>
                  </div>
                  
                  {/* Instructional Banner */}
                  <div className="bg-black/75 text-white px-3 py-1 rounded-md text-xs backdrop-blur-sm">
                      {drawPoints.length === 0 ? "Click map to start drawing" : 
                       drawPoints.length < 3 ? "Click more points..." : 
                       "Shape ready! Click 'APPLY SEARCH AREA' above"}
                  </div>
              </div>
          )}

          {/* HAS DRAWN SHAPE STATE (Active Filter) */}
          {!isDrawing && drawPoints.length > 0 && (
              <div className="pointer-events-auto flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full shadow-lg border border-blue-200 dark:border-blue-700 font-semibold text-sm">
                     <ScanSearch className="w-4 h-4" />
                     <span>Custom Area Active</span>
                  </div>
                  
                  <button
                     onClick={() => setIsShapeVisible(!isShapeVisible)}
                     className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-medium text-sm"
                     title={isShapeVisible ? "Hide Shape Overlay" : "Show Shape Overlay"}
                  >
                     {isShapeVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     <span>{isShapeVisible ? "Hide" : "Show"}</span>
                  </button>

                  <button
                     onClick={() => {
                         // Clear Visuals
                         setDrawPoints([]); 
                         
                         // Clear Data Filter
                         if (onSearchArea) {
                             // Send undefined shape and empty bounds to reset filter
                             onSearchArea([0, 0, 0, 0], undefined);
                         }
                     }}
                     className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-semibold text-sm group"
                  >
                     <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                     <span>Clear Shape</span>
                  </button>
              </div>
          )}
       </div>

      {/* Measure Tool Control - Keep separate */}
      <div className="absolute top-48 right-3 z-10 flex flex-col gap-2">
         <button
            onClick={() => {
                setIsMeasureMode(!isMeasureMode);
                setMeasurePoints([]);
                setMeasureDistance(null);
            }}
            className={`p-2 rounded-md shadow-lg transition-colors border ${
                isMeasureMode 
                ? 'bg-cyan-600 text-white border-cyan-700' 
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            }`}
            title="Measure Distance"
         >
            <Ruler className="w-5 h-5" />
         </button>
      </div>

      {/* Measure Result */}
      {measureDistance !== null && (
          <div className="absolute top-16 right-16 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg shadow-xl border-l-4 border-cyan-500 z-20 flex items-center gap-3">
             <div>
                <div className="text-xs text-gray-500 dark:text-gray-300 font-bold uppercase tracking-wider">Distance</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {measureDistance.toFixed(2)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">miles</span>
                </div>
             </div>
             <button 
               onClick={() => {
                   setMeasurePoints([]);
                   setMeasureDistance(null);
               }}
               className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
                <X size={16} />
             </button>
          </div>
      )}
      
       {isLoading && (
         <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50">
             <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-xl flex items-center gap-3">
                 <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                 <span className="text-sm font-medium text-gray-900 dark:text-white">Loading Map Data...</span>
             </div>
         </div>
      )}

      {/* External Link Confirmation */}
      <ConfirmModal 
        isOpen={!!externalLink}
        onClose={() => setExternalLink(null)}
        onConfirm={() => {
            if (externalLink) window.open(externalLink.url, '_blank');
        }}
        title="Leaving Land Oracle"
        message={
            (externalLink?.county?.toLowerCase() === 'citrus')
            ? (() => {
                // Determine Search Group based on Land Use
                let group = "Residential";
                const use = externalLink.landUse || "000";
                if (use.startsWith("01") || use.startsWith("02") || use.startsWith("03") || use.startsWith("04")) group = "Commercial/Industrial";
                if (use.startsWith("05") || use.startsWith("06")) group = "Agricultural";
                if (use.startsWith("07") || use.startsWith("08") || use.startsWith("09")) group = "Other/Govt";
                
                return `We have copied the Parcel ID (${externalLink?.id}).\n\n1. Go to **Parcel Search** > **Parcel ID**.\n2. Paste ID & click **Add** button.\n3. Ensure Group is **${group}**.\n4. Click Search.`;
            })()
            : (['union', 'bradford', 'putnam', 'desoto', 'pasco', 'hernando', 'columbia', 'lafayette', 'suwannee', 'madison', 'leon', 'franklin'].includes(externalLink?.county?.toLowerCase() || '')) 
            ? `You are visiting the ${externalLink?.county} GIS. Direct linking is restricted, so we have copied the Parcel ID to your clipboard. Please PASTE it into the search bar.`
            : `You are about to visit the ${externalLink?.county || 'County'} Property Appraiser's official website.`
        }

        confirmLabel="Continue to Site"
        isExternal={true}
      />
    </div>
  );
}

